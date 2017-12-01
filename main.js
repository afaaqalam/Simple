var express = require('express');
var app = express();
var http = require('http').createServer(app);  
var io = require('socket.io')(http);

var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var sessions = require('client-sessions');
var path = require('path');
var morgan = require('morgan')
var cors = require('cors')

//Jade
app.use(express.static(path.join(__dirname,'public')));
app.set('view engine', 'jade');
app.set('views', __dirname + '/public/views');

app.use(morgan('combined'));
app.use(cors());
//app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}));
app.use(sessions({
  cookieName: 'session',
  secret: 'asdfqwer1234wqedfasdfa',
  duration: 30 * 60 * 1000,
  activeDuration: 5 * 60 * 1000,
}))

//Database

var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;
mongoose.connect('mongodb://localhost/auth', { useMongoClient: true });

var User = mongoose.model('User', new Schema({
  id: ObjectId,
  firstName: String,
  lastName: String,
  email: {type: String, unique: true},
  password: String
}));

var CountrySchema = Schema({
  country: String,
  capital: String
});


//all the models

//Socket Testing



var country = "India";
var AllGames = {};

io.on('connection', function (socket) {
  console.log("User "+ socket.id + " connected"); 
  
  socket.on('disconnect', function(){
    setTimeout(function () {
      console.log("User "+ socket.id +" disconnected!");
    }, 10000);
    //console.log("User "+ socket.id +" disconnected!");
  });

  var list = io.sockets.sockets; 
  console.log("Connected sockets:"); 
  Object.keys(io.sockets.sockets).forEach(function(id){ 
    console.log("ID: ",id);
  }); 


  socket.on('sendQ', function(){
    socket.emit('newQ', {c: country});
    console.log("SID: "+country);
  });

  var sid;
  var uEmail;//req.session.user;

  
  //var dict = {'gameid', 'countPlayer'};
  socket.on('createGameRoom', function(){
    var thisGameId = (Math.random() * 100000) | 0;
    socket.emit('newGameRoomCreated', {gameId: thisGameId, mySocketId: socket.id, email: uEmail});
    console.log('GameRoomCreated: '+thisGameId+" user email: ");//+user);
    socket.join(thisGameId.toString());
    sid = socket.id;
    var numPlayersInRoom = 1;
    AllGames[thisGameId] = numPlayersInRoom;
    //console.log("AllGames-gameId: "+AllGames.gameId+ "  AllGames-numPlayersInRoom: "+AllGames.numPlayersInRoom);
    //create an entry in db now // { "4121231": 1}
    socket.on('sendQ', function(data){
    console.log(data);
    socket.emit('newQ', {Scktid: sid});
  }); 
    
  });

  socket.on('listGameRooms', function(){
    console.log('sending AllGames to client..');
    socket.emit('sendGameRooms', AllGames);
    console.log('emitted sendGameRooms');  
  });

  socket.on('joinTo', function(gRoom){
    socket.join(gRoom);
    console.log('Joined '+gRoom);
    AllGames[gRoom] = 2;
    //write to db both players and game model and resume model
    //gameInit();
    console.log('emitted startTimer to '+gRoom);
    io.to(gRoom).emit('startTimer');
  });
});

//function gameInit(){
//};


//Routes

app.get('/', function(req,res){
  res.render('index.jade');
});

app.get('/register', function(req, res){
  res.render('register.jade');
});

app.post('/register', function(req, res) {
  var user = new User({
    firstName:  req.body.firstName,
    lastName:   req.body.lastName,
    email:      req.body.email,
    password:   req.body.password
  });
  user.save(function(err) {
    if (err) {
      var error = 'Something bad happened! Please try again.';

      if (err.code === 11000) {
        error = 'That email is already taken, please try another.';
      }

      res.render('register.jade', { error: error });
    } else {
      //utils.createUserSession(req, res, user);
      res.redirect('/dashboard');
    }
  });
});

app.get('/login', function(req, res){
  if(req.session && req.session.user){
	User.findOne({email: req.session.user.email}, function(err,user){
		if(!user){
			req.session.reset();
			res.redirect('/login');
		} else{
			res.locals.user = user;
			res.render('dashboard.jade');
		}
	})
  }
  else {		
  res.render('login.jade');
  }
});

app.post('/login', function(req, res){
  User.findOne({email: req.body.email }, function(err, user){
    if(!user){
      res.render('login.jade', {error: 'Invalid email or password!'});
    }
    else{
      if(req.body.password === user.password){
        req.session.user = user;
        console.log("request-session-user: "+req.session.user);
        res.redirect('/dashboard');
      } else {
        res.render('login.jade', {error: 'Invalid email or password!'});
      }
    }
  })
});

app.get('/dashboard', function(req, res){
  if(req.session && req.session.user){
    User.findOne({email: req.session.user.email}, function(err,user){
      if(!user){
        req.session.reset();
        res.redirect('/login');
      } else{
        res.locals.user = user;
        //console.log("request-session-user: "+req.session.user);
        console.log("request-locals-user: "+res.locals.user.email);
        res.render('dashboard.jade');
      }
    })
  }
  else{
    res.redirect('/login');
  }
});

app.get('/logout', function(req, res){
  req.session.reset();
  res.redirect('/');
});

var port = process.env.PORT || 3000;
http.listen(port, '127.0.0.1');
console.log("Server is listening on "+ port);


//io.sockets.connected[ socket.id ].emit('privateMsg', 'hello this is a private msg');