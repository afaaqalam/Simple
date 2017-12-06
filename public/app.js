//var socket = io({transports: ['websocket'], upgrade: false}).connect("http://localhost:3000");
var socket = io.connect("https://localhost:3000");
var App = { gRoomId: 0, 
            pEmail: "",
            mySocketId: 0, 
            numPlayersInRoom: 0, 
            roundCount: 0, 
            currCountry: 0,
            totalScore: 0, 
            
};

var score = [0,0,0,0,0,0,0,0,0,0,0];
var allCountries = [];
var localStats = [];
socket.on('newGameRoomCreated', function(data){
  App.gRoomId = data.gRoomId;
  App.mySocketId = data.mySocketId;
  App.numPlayersInRoom = data.numPlayersInRoom;
  App.points = 0;
  console.log('GameRoom created with Id: '+ App.gRoomId + ' and socketId: '+ App.mySocketId + ' with '+App.numPlayersInRoom+' Players');
  $(".options").hide();
  $(".waitMsg").show();
});

socket.on('sendGameRooms', function(AllRooms){
  $(".options").hide();
  $(".joinMsg").show();
  
  for(var i in AllRooms){
    if(AllRooms[i] < 2){
      console.log(i+" has "+AllRooms[i]+" player(s)");
      $("<input type='radio' name='radiobtn' value="+ i +">"+ i +"</input><br/>").appendTo("#roomList");
    }
  } 
  console.log(AllRooms);
  $("#jRoomBtn").show();
});

socket.on('updateGameInfo', function(info){
  App.gRoomId = info.gRoomId;
  App.mySocketId = info.mySocketId;
  App.numPlayersInRoom = info.numPlayersInRoom;
  App.roundCount = info.roundCount;
  console.log(info);

  if(info.resume === 1){
    console.log('control came inside resume==1');
    var countryInfo = {
                        'countryId': allCountries[App.roundCount],
                        'sid': App.mySocketId,
                        'gRoomId': App.gRoomId,                        
                        'roundCount':App.roundCount
                      };
    console.log(countryInfo);                      
    //callSendQuestion(countryInfo);
    //AutoResumeGame();
    console.log('emitting imBack with:  '+App.gRoomId);
    socket.emit('imBack', {"gRoomId": App.gRoomId, "mySocketId":App.mySocketId});
  }
});

socket.on('startTimer',function(){
  console.log('countDowner called');
  var $timeLeft = $("#countDown");
  countDowner($timeLeft, 2, syncUs)
}); 

socket.on('startTimer2',function(){
  $("#FieldAns").hide();
  $("#content").hide();
  $(".waitMsg").hide();
  console.log('countDowner called');
  var $timeLeft = $("#countDown");
  countDowner($timeLeft, 2, autoResumeGame)
}); 

function syncUs(){
  var countryInfo = {
                      'countryId': allCountries[App.roundCount], 
                      'gRoomId': App.gRoomId,
                      'sid': App.mySocketId,
                      'roundCount': App.roundCount 
                    };
  console.log(countryInfo);
  callSendQuestion(countryInfo);
  console.log('Emitted SendQuestion');
};

function callSendQuestion(countryInfo){
  console.log("emitting sendQuestion countryId: "+countryInfo.countryId);
  socket.emit('sendQuestion', countryInfo);
};

socket.on('takeAllCountries', function(countries_id){
  allCountries = countries_id;
  console.log("received countries: "+allCountries);
});

socket.on('takeQuestion', function(question){
  App.currCountry = question.country;
  console.log('Next question country received from server: '+question.country);
  //$("<p>What is the capital of "+question.country+" ?</p><br/>").appendTo("#qOne");
  $.toast({
    heading: 'Question',
    text: 'What is the capital of '+question.country+" ?",
    showHideTransition: 'slide', 
    hideAfter: 30000,
    position: {top: 175, left: 280},
    allowToastClose: false,
    afterHidden: function(){submitAnswer();}, 
  });
  $("#FieldAns").show(); // show textbox ans submit button
});

socket.on('questionResult', function(data){
  score[App.roundCount] += data.point;
  App.totalScore += data.point;
  console.log("Server sent Score: "+data.point+" for round: "+App.roundCount+" & totalScore: "+App.totalScore);
  App.roundCount += 1;
  if(App.rountCount === 9){
    console.log("Game ended with totalScore: "+App.totalScore+" with this: "+score)
  }  
});

socket.on('takeFinalResult', function(data){
  console.log(data);
});

socket.on('takeStats', function(data){
  localStats = data;
});

socket.on('sendGameData', function(data){
  console.log('emitted takeGameData');
  socket.emit('takeGameData',{"email":App.pEmail, "gRoomId":App.gRoomId, "socketId":App.mySocketId});
});

socket.on('waitForResult',function(){
  $(".waitMsg").text("Wait for second Player to finish.")
  $(".waitMsg").show();

});

socket.on("pauseGame",function(email){
  if(email !== App.pEmail)
  {
    $.toast().reset('all');
    $(".waitMsg").text("Wait for second Player to rejoin!")
    $(".waitMsg").show();
    //setTimeInterval for 30 seconds to endGame.
    //call AutoResumeGame
  }
});

function autoResumeGame(){
  var countryInfo = { 
                      'countryId': allCountries[App.roundCount], 
                      'gRoomId ': App.gRoomId, 
                      'sid': App.mySocketId, 
                      'roundCount':App.roundCount
                    };
  callSendQuestion(countryInfo);
  
};

socket.on('resumeTest',function(data){
  console.log('resumeTest was hit!'+data);
});

var createRoom = function(){
  socket.emit('createGameRoom', {"email":App.pEmail});
  console.log('emitted createGameRoom');
};

var listGameRooms = function(){
  socket.emit('listGameRooms');
  console.log('emitted listGameRooms');
};

var joinRoom = function(){
  var gRoomId = $("input:radio:checked").val();
  App.gRoomId = gRoomId;
  console.log('->value now: '+App.gRoomId);
  var content = {'gRoomId': App.gRoomId, 'email': App.pEmail};
  console.log("Value of gRoodId:  "+gRoomId);
  socket.emit('joinTo', content);
  $(".joinMsg").hide();
  //$(".waitMsg").hide();
  $("#roomList").hide();
  console.log('GRoomId sent to Join: '+$("input:radio:checked").val());
};


function countDowner( $element, startTime, callback) {
  $(".waitMsg").hide();
  $element.show();
  $element.text(startTime);
  var timer = setInterval(countItDown,1000);
  function countItDown(){
    startTime -= 1
    $element.text(startTime);
    if( startTime <= 0 ){
      console.log('CountDowner Finished.');
      clearInterval(timer);
      callback();
      $element.hide();
      return;
    }
  }
};

         

function submitAnswer(){
  var uAnswer = $("#ansInput").val();
  var myAnswer = {'gRoomId':App.gRoomId, 'country': App.currCountry, "myAns": uAnswer, "sid": App.mySocketId, "nextId": allCountries[App.roundCount+1], "email": App.pEmail, "point": score[App.roundCount], "round": App.roundCount};
  console.log(myAnswer.email+" with SID "+App.mySocketId+" emitted checkAnswer with: "+uAnswer+" for country: "+App.currCountry+" with score: "+myAnswer.point+" for round: "+myAnswer.round+" and nextId: "+myAnswer.nextId);
  $.toast().reset('all'); //remove the question toast
  $('#ansInput').val(''); // clear the textbox value
  $('#sendAnsBtn').attr('disabled','disabled'); // disable the submit btn
  socket.emit('checkAnswer', myAnswer); // emit answer
};

function cResumeGame(){
  var data = {'email':App.pEmail};
  console.log('emitting checkResumeGame');
  socket.emit('cResumeGame',data);
  
};

function fetchStats(){
  console.log('emitting fetchStats.');
  //handle logic for display on UI
};

function test(){
  console.log("test hit!");
};
$(function(){
  $("#cRoomBtn").one('click',function(){
    createRoom();
  });

  $("#lRoomBtn").one('click',function(){
    listGameRooms();
  });

  $("#jRoomBtn").one('click',function(){
    joinRoom();
  });
  
  $("#rGameBtn").one('click',function(){
    console.log('resume btn clicked');
    cResumeGame();
  });

  $("#gStats").one('click',function(){
    console.log('stats link clicked!');
    fetchStats();
  })

  $("#sendAnsBtn").bind('click',function(){
    submitAnswer();
  });

  App.pEmail = $("#hEmail").text();
  console.log('Created global email variable: '+App.pEmail);
});

$(document).ready(function() {
  $('#sendAnsBtn').attr('disabled','disabled');
  //console.log('inside btn logic')
  $('#ansInput').keyup(function() {
     if($(this).val() != '') {
       //console.log('submit btn toggled!');
        $('#sendAnsBtn').removeAttr('disabled');
     }
     else{
      $('#sendAnsBtn').attr('disabled','disabled');
     }
  });
});
