//var socket = io({transports: ['websocket'], upgrade: false}).connect("http://localhost:3000");
var socket = io.connect("http://localhost:3000");

/*
var socket = io.connect("http://localhost:3000", { 
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax : 5000,
  reconnectionAttempts: 99999
});*/

/*socket.on('connect', function(data) {
   socket.emit('onMessage', 'Client: I just connected to you!');
   socket.on('onMessage',function(message){
    console.log(message); 
  });
});*/

socket.on('newQ', function(question){
  //App.id = question.c;
  //alert(q);
  $("<p>What is the capital of "+ question +" ?</p><br/>").appendTo("#qOne");
  $("#FieldAns").show();
  $("#qOne").text(question);
});

var App = {gameId:0, mySocketId:0, numPlayersInRoom:0, points: 0, id:0};

socket.on('newGameRoomCreated', function(data){
  App.gameId = data.gameId;
  App.mySocketId = data.mySocketId;
  App.numPlayersInRoom = 1;
  App.points = 0;
  console.log('GameRoom created with Id: '+ App.gameId + ' and socketId: '+ App.mySocketId + ' with '+App.numPlayersInRoom+' Players');
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

socket.on('testQuestion', function(data){
  alert(data);
  console.log("Server: "+data);
});

socket.on('startTimer',function(){
  console.log('countDowner called');
  var $timeLeft = $("#countDown");
  countDowner($timeLeft, 5, start)
}); 

var createRoom = function(){
  socket.emit('createGameRoom');
  console.log('emitted createGameRoom');
};

var listGameRooms = function(){
  socket.emit('listGameRooms');
  console.log('emitted listGameRooms');
};

var joinRoom = function(){
  console.log("Joining room: "+ $("input:radio:checked").val());
  var gRoom = $("input:radio:checked").val();
  socket.emit('joinTo', gRoom);
  $(".joinMsg").hide();
  //$(".waitMsg").hide();
  $("#roomList").hide();
  console.log('GameRoom to Join: '+$("input:radio:checked").val());
  //alert($("input:radio:checked").val());
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

function start(){
  socket.emit('sendQ');
  console.log("emitted sendQ");
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
});
