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
  App.numPlayersInRoom = info.numPlayersInRoom
});

socket.on('startTimer',function(){
  console.log('countDowner called');
  var $timeLeft = $("#countDown");
  countDowner($timeLeft, 2, syncUs)
}); 

socket.on('takeAllCountries', function(countries_id){
  //console.log(countries);
  //countries = [1,2,3,4,5,6,7,8,9,10];
  //allCountries = countries_id;
  //console.log(allCountries);
  allCountries = countries_id;
  //var countryInfo = {'countryId': allCountries[App.roundCount], 'gRoomId ': App.gRoomId, 'sid': App.mySocketId}
  //callSendQuestion(countryInfo);
  //console.log(App.mySocketId+" emitted sendQuestion from gRoomId: "+App.gRoomId+" with countryId: "+countries[App.roundCount]);
  //socket.emit('sendQuestion1', countryInfo); // make this in another function and hit this 
  
  //function with an emit from server which means create on receive event for what server emits
});

function callSendQuestion(countryInfo){
  console.log("emitting sendQuestion countryId: "+countryInfo.countryId);
  socket.emit('sendQuestion', countryInfo);
};

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

/*socket.on('wrongAnswer', function(message){
  //$("#info").show();
  //$("#info").text(message);
});*/

socket.on('questionResult', function(data){
  score[App.roundCount] += data.point;
  App.totalScore += data.point;
  console.log("Server sent Score: "+data.point+" for round: "+App.roundCount+" & totalScore: "+App.totalScore);
  App.roundCount += 1;
  if(App.rountCount === 9){
    console.log("Game ended with totalScore: "+App.totalScore+" with this: "+score)
    //
  }  
  //$("#totalScore").show();
  //$("#totalScore").text(App.totalScore);
});

socket.on('takeFinalResult', function(data){
  console.log(data);
});

socket.on('sendGameData', function(data){
  console.log('emitted takeGameData');
  socket.emit('takeGameData',{"email":App.pEmail, "gRoomId":App.gRoomId, "socketId":App.mySocketId});
});

socket.on('waitForResult',function(){
  $(".waitMsg").text("Wait for second Player to finish.")
  $(".waitMsg").show();

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
  console.log("Joining GRoomId: "+ $("input:radio:checked").val());
  var gRoomId = $("input:radio:checked").val();
  socket.emit('joinTo', {"gRoomId":gRoomId, "email":App.pEmail});
  $(".joinMsg").hide();
  //$(".waitMsg").hide();
  $("#roomList").hide();
  console.log('GRoomId to Join: '+$("input:radio:checked").val());
  //alert($("input:radio:checked").val());
};
// create a countdown timer for 30 seconds that calls another function with emit(timedOut)
// on server on(timedOut) -> emit(takeQuestion)
// before emitting(timedOut) make sure roundCount < 10
// have a property that is sent as part of client's emit(timedOut) which will be check in
// server if found true insert null as user's answer in gamemodel

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

function syncUs(){
  //var data = {'sid':App.mySocketId, 'gRoomId':App.gRoomId};
  //socket.emit('getAllCountries', data);
  //console.log(App.mySocketId+" emitted sendQ in GameRoom: "+App.gRoomId);
  var countryInfo = {'countryId': allCountries[App.roundCount], 'gRoomId ': App.gRoomId, 'sid': App.mySocketId}
  callSendQuestion(countryInfo);
  console.log('Emitted SendQuestion');
};          

function submitAnswer(){
  var uAnswer = $("#ansInput").val();
  var myAnswer = {'gRoomId':App.gRoomId, 'country': App.currCountry, "myAns": uAnswer, "sid": App.mySocketId, "nextId": allCountries[App.roundCount+1], "email": App.pEmail, "point": score[App.roundCount], "round": App.roundCount};
  console.log(myAnswer.email+" with SID "+App.mySocketId+" emitted checkAnswer with: "+uAnswer+" for country: "+App.currCountry+" with score: "+myAnswer.point+" for round: "+myAnswer.round+" and nextId: "+myAnswer.nextId);
  $.toast().reset('all'); //remove the question toast
  $('#ansInput').val(''); // clear the textbox value
  $('#sendAnsBtn').attr('disabled','disabled'); // disable the submit btn
  /*if(App.rountCount === 9){
    console.log("Game ended with totalScore: "+App.totalScore+" with this: "+score)
    socket.emit('endGame',{'email': App.totalScore, })
  }*/
  //else{
    socket.emit('checkAnswer', myAnswer); // emit answer
  //}
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

  $("#sendAnsBtn").bind('click',function(){
    //console.log('submit btn clicked!');
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
