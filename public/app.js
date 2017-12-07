var socket = io.connect("https://localhost:3000");
var App = { gRoomId: 0, 
            pEmail: "",
            pName: "",
            mySocketId: 0, 
            numPlayersInRoom: 0, 
            roundCount: 0, 
            currCountry: 0,
            totalScore: 0, 
            
};

var score = [0,0,0,0,0,0,0,0,0,0,0];
var allCountries = [];
var localStats = [];
var gameSummary = [];
var gameHistory = [];

socket.on('newGameRoomCreated', function(data){
  App.gRoomId = data.gRoomId;
  App.mySocketId = data.mySocketId;
  App.numPlayersInRoom = data.numPlayersInRoom;
  App.points = 0;
  //console.log('GameRoom created with Id: '+ App.gRoomId + ' and socketId: '+ App.mySocketId + ' with '+App.numPlayersInRoom+' Players');
  $(".options").hide();
  $(".waitMsg").show();
});

socket.on('sendGameRooms', function(AllRooms){
  $(".options").hide();
  $(".joinMsg").show();
  
  for(var i in AllRooms){
    if(AllRooms[i] < 2){
      //console.log(i+" has "+AllRooms[i]+" player(s)");
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
    //console.log('control came inside resume==1');
    var countryInfo = {
                        'countryId': allCountries[App.roundCount],
                        'sid': App.mySocketId,
                        'gRoomId': App.gRoomId,                        
                        'roundCount':App.roundCount
                      };
    //console.log(countryInfo);                      
    //console.log('emitting imBack with:  '+App.gRoomId);
    socket.emit('imBack', {"gRoomId": App.gRoomId, "mySocketId":App.mySocketId});
  }
});

socket.on('startTimer',function(){
  //console.log('countDowner called');
  var $timeLeft = $("#countDown");
  countDowner($timeLeft, 2, syncUs)
}); 

socket.on('startTimer2',function(){
  $("#FieldAns").hide();
  $("#content").hide();
  $(".waitMsg").hide();
  //console.log('countDowner called');
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
  //console.log(countryInfo);
  callSendQuestion(countryInfo);
};

function callSendQuestion(countryInfo){
  //console.log("emitting sendQuestion countryId: "+countryInfo.countryId);
  socket.emit('sendQuestion', countryInfo);
};

socket.on('takeAllCountries', function(countries_id){
  allCountries = countries_id;
  //console.log("received countries: "+allCountries);
});

socket.on('takeQuestion', function(question){
  App.currCountry = question.country;
  //console.log('Next question country received from server: '+question.country);
  $.toast({
    heading: 'Question',
    text: 'What is the capital of '+question.country+" ?",
    showHideTransition: 'slide', 
    hideAfter: 30000,
    position: {top: 175, left: 280},
    allowToastClose: false,
    afterHidden: function(){submitAnswer();}, 
  });
  $("#FieldAns").show();
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
  //console.log(data.decision);
  //console.log(data.summary);
  gameSummary = data.summary;
  populateSummary();
  $(".waitMsg").hide();
  $("#FieldAns").hide();
  $.toast({
    heading: 'Result',
    text:  data.decision[0].Player+" "+data.decision[0].Decision+" with "+data.decision[0].Total+" points AND "+data.decision[1].Player+" "+data.decision[1].Decision+" with "+data.decision[1].Total+" points",
    showHideTransition: 'slide', 
    hideAfter: false,
    position: 'bottom-center',
    allowToastClose: true,
    
  });
});

function populateSummary(){
  $("#gSum-table").show();
  $("#gSum-table").tabulator("setData", gameSummary);  
};

socket.on('takeStats', function(data){
  console.log('received stats');
  localStats = data;
  console.log(localStats);
});

socket.on('sendGameData', function(data){
  console.log('emitted takeGameData');
  socket.emit('takeGameData',{"email":App.pEmail, "gRoomId":App.gRoomId, "socketId":App.mySocketId});
});

socket.on('waitForResult',function(){
  $(".waitMsg").text("Wait for second Player to finish.")
  $(".waitMsg").show();
  $("#FieldAns").hide();

});

socket.on("pauseGame",function(email){
  if(email !== App.pEmail)
  {
    $.toast().reset('all');
    $(".waitMsg").text("Wait for second Player to rejoin!")
    $(".waitMsg").show();
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

socket.on('takeGameHistory', function(data){
  gameHistory = data;
  $("#stats-table").hide();
  $("#content").hide();
  $("#gSum-table").hide();
  $("#gHistory-table").show();
  $("#gHistory-table").tabulator("setData", gameHistory);

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
  $.toast().reset('all');
  $('#ansInput').val('');
  $('#sendAnsBtn').attr('disabled','disabled');
  socket.emit('checkAnswer', myAnswer);
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

  $("#gPlayNow").bind('click',function(){
    console.log("Play now Clicked!");
    $("#content").show();
    $("#gSum-table").hide();
    $("#stats-table").hide();
    $("#qOne").hide();
    $("#FieldAns").hide();
    $("#roomList").hide();
    $("#gHistory-table").hide();
    $("#content").show();
  });

  $("#gStats").bind('click',function(){
    //console.log('stats link clicked!');
    //console.log(localStats);
    $("#stats-table").show();
    $("#stats-table").tabulator("setData", localStats);
    $("#content").hide();
    $("#gSum-table").hide();
    $("#gHistory-table").hide();

    //fetchStats(); // decide when to call after current game is over!!!!!!!!!
  });

  $("#gHistory").bind('click', function(){
    console.log('game history clicked!');
    console.log("emitted sendGameHistory");
    socket.emit('sendGameHistory', {"email": App.pEmail, "socketId":App.mySocketId});
  });

  $("#sendAnsBtn").bind('click',function(){
    submitAnswer();
  });

  App.pEmail = $("#hEmail").text();
  console.log('Created global email variable: '+App.pEmail);

  App.pName = $("#hName").text();
  console.log('Created global name variable: '+App.pName);
});

$(document).ready(function() {
  $('#sendAnsBtn').attr('disabled','disabled');
  $('#ansInput').keyup(function() {
     if($(this).val() != '') {
       //console.log('submit btn toggled!');
        $('#sendAnsBtn').removeAttr('disabled');
     }
     else{
      $('#sendAnsBtn').attr('disabled','disabled');
     }
  });

  $("#stats-table").tabulator({
    height: "311px",
    layout: "fitColumns",
    columns: [
                {title: "Player", field: "name"},
                {title: "Wins", field: "wins"},
                {title: "Losses", field: "losses"},
  
            ]
  }).hide();

  $("#gSum-table").tabulator({
    height: "301px",
    layout: "fitColumns",
    columns: [
                {title: "Questions", field: "Questions"},
                {title: "Country", field: "Country"},
                {title: "Capital", field:"CorrectAnswer"},
                {title: "Player 1", field:"Player1"},
                {title: "Answer", field: "Player1-Answer"},
                {title: "Points", field: "Player1-Points", bottomCalc: "sum"},
                {title: "Player 2", field:"Player2"},
                {title: "Answer", field:"Player2-Answer"},
                {title: "Points", field:"Player2-Points", bottomCalc: "sum"},
              ]
  }).hide();

  $("#gHistory-table").tabulator({
    height: "350px",
    layout: "fitColumns",
    columns: [
                {title: "Questions", field: "Questions"},
                {title: "Country", field: "Country"},
                {title: "Capital", field:"CorrectAnswer"},
                {title: "Player 1", field:"Player1"},
                {title: "Answer", field: "Player1-Answer"},
                {title: "Points", field: "Player1-Points"},
                {title: "Player 2", field:"Player2"},
                {title: "Answer", field:"Player2-Answer"},
                {title: "Points", field:"Player2-Points"},
              ]
  }).hide();

});
