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
  alert(question);
});

var App = {gameId:0, mySocketId:0, numPlayersInRoom:0};

socket.on('newGameRoomCreated', function(data){
  App.gameId = data.gameId;
  App.mySocketId = data.mySocketId;
  App.numPlayersInRoom = 1;
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

  $("#getQ").bind('click',function(){
    //alert('clicked me!');
    sendQuestion();
  });

});


function sendQuestion(){
  socket.emit('sendQ','Client: send me a question!');
};

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
  socket.emit('jointo', gRoom);
  //alert($("input:radio:checked").val());
};

