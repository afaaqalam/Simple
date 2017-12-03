var express = require('express');
var app = express();
var http = require('http').createServer(app);  
var io = require('socket.io')(http);

var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var mysql = require('mysql');
var session = require('express-session');
var path = require('path');
var morgan = require('morgan')
var cors = require('cors')
var bcrypt = require('bcrypt');
var validator = require('express-validator');

//Jade
app.use(express.static(path.join(__dirname,'public')));
app.set('view engine', 'jade');
app.set('views', __dirname + '/public/views');

app.use(morgan('combined'));
app.use(cors());
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}));
app.use(validator());
app.use(session({
  cookieName: 'cqsession',
  secret: 'asdfqwer1234wqedfasdfa',
  saveUninitialized: false,
  resave: false,
  cookie: { maxAge: 600000, secure: false  },
}));

//Password Hashing
var saltRounds = 11;

//Database
var con = mysql.createConnection({
  host: "localhost",
  user: "crossquiz",
  password: "isa681",
  database: "testing",
  multipleStatements: true
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected to Database!");
  var sql = 'CREATE TABLE IF NOT EXISTS user (name CHAR(255), email VARCHAR(255) PRIMARY KEY, password VARCHAR(255)); CREATE TABLE IF NOT EXISTS countries (id INTEGER AUTO_INCREMENT, country VARCHAR(255), capital VARCHAR(255), PRIMARY KEY(id) ); CREATE TABLE IF NOT EXISTS stats(email VARCHAR(255) PRIMARY KEY, wins INTEGER, losses INTEGER); CREATE TABLE IF NOT EXISTS game (game_id INTEGER, email VARCHAR(255), CONSTRAINT PK_Game PRIMARY KEY (game_id, email)); CREATE TABLE IF NOT EXISTS gamescores (game_id INTEGER, email VARCHAR(255), q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER, q5 INTEGER, q6 INTEGER, q7 INTEGER, q8 INTEGER, q9 INTEGER, q10 INTEGER, FOREIGN KEY(game_id, email) REFERENCES game(game_id, email)); CREATE TABLE IF NOT EXISTS gamemoves (game_id INTEGER, email VARCHAR(255), a1 VARCHAR(255), a2 VARCHAR(255), a3 VARCHAR(255), a4 VARCHAR(255), a5 VARCHAR(255), a6 VARCHAR(255), a7 VARCHAR(255), a8 VARCHAR(255), a9 VARCHAR(255), a10 VARCHAR(255), FOREIGN KEY(game_id, email) REFERENCES game(game_id, email) ); CREATE TABLE IF NOT EXISTS gq (game_id INTEGER, id INTEGER, FOREIGN KEY(id) REFERENCES countries(id));';
  con.query(sql, function (err, result) {
    if (err) throw err;
    console.log("All tables created!");
  });
});



//Socket Testing
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
    socket.emit('newQ', "India");
    //console.log("SID: "+country);
  });

  var sid;
  
  
  //var dict = {'gameid', 'countPlayer'};
  socket.on('createGameRoom', function(){
    var thisGameId = (Math.random() * 100000) | 0;
    socket.emit('newGameRoomCreated', {gameId: thisGameId, mySocketId: socket.id});
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

//Routes

app.get('/', function(req,res){
  res.render('index.jade');
});

app.get('/register', function(req, res){
  res.render('register.jade');
});

app.post('/register', function(req, res) {
  //validate name, email, password input
  var name = req.body.name;
  var email = req.body.name;
  var password = req.body.name;

  req.checkBody('name', 'Name is required!').notEmpty();
  req.checkBody('email', 'Email address is required!').notEmpty();
  req.checkBody('email', 'Enter a valid Email address!').isEmail();
  req.check('password', 'Password must be at least 8 characters long!').isLength({ min: 8 });
    
  var errors = req.validationErrors();

  if(errors){
    console.log(errors);
    return res.render('register.jade', {error: errors});
  }

  bcrypt.hash(req.body.password, 11, function(err, hPassword){
    if(err){
      console.log(err);
    }
    var sql = "INSERT INTO user VALUES(?, ?, ?)";
    var inserts = [req.body.name, req.body.email, hPassword];
    sql = mysql.format(sql, inserts);
    con.query(sql,function(err){
      if(err){
        var error = 'Something bad happened! Please try again.';
        if(err.code === 'ER_DUP_ENTRY'){
          error = 'That email is already taken, please try another.'
        }
        res.render('register.jade', {error: error});
      }
      else{
        res.redirect('/login');
      }
    });
  });
});

app.get('/login', function(req, res){
  if(req.session && req.session.email){
    var sql = "SELECT * from user where email = ?";
    var inserts = [req.session.email];
    sql = mysql.format(sql, inserts);
    con.query(sql, function(err, results, fields){
      if(results.length < 0){
        req.session.destroy();
        res.redirect('/login');
      }
      else{
        res.locals.email = results[0].email;
        res.locals.name = results[0].name;
        res.render('dashboard.jade');
      }
    });
  }
  else {		
  res.render('login.jade');
  }
});

app.post('/login', function(req, res){
  var email = req.body.name;
  var password = req.body.name;

  req.checkBody('email', 'Invalid email or password!').notEmpty();
  req.checkBody('email', 'Invalid email or password!').isEmail();
  req.check('password', 'Invalid email or password!').isLength({ min: 8 });
    
  var errors = req.validationErrors();

  if(errors){
    console.log(errors);
    return res.render('login.jade', {error: errors});
  }

  var sql = "SELECT * FROM user WHERE email = ?";
  var inserts = [req.body.email];
  sql = mysql.format(sql,inserts);
  console.log("login query: ",sql);
  con.query(sql, function(err, results, fields){
    if(err){
      console.log(err);
      res.render('login.jade', {error:'Invalid email or password!'});
    }
    else{
      console.log('no error, checking results length');
      if(results.length > 0){
        bcrypt.compare(req.body.password, results[0].password, function(err, fin){
          if(!fin){
            res.render('login.jade',{error: 'Invalid email or password!'});
          }
          req.session.email = req.body.email;
          req.session.name = results[0].name;
          res.redirect('/dashboard');
        });
      }
      else{
        res.render('login.jade',{error: 'Invalid email or password!'});
      }
    }  
  });
});

app.get('/dashboard', function(req, res){
  if(req.session && req.session.email){
    var sql = "SELECT * from user where email = ?";
    var inserts = [req.session.email];
    sql = mysql.format(sql, inserts);
    con.query(sql, function(err, results, fields){
      if(results.length < 0){
        req.session.destroy();
        res.redirect('/login');
      }
      else{
        res.locals.email = results[0].email;
        res.locals.name = results[0].name;
        res.render('dashboard.jade');
      }
    });
  }
  else{
    res.redirect('/login');
  }
});    

app.get('/stats', function(req, res){
  if(req.session && req.session.email){
    var sql = "SELECT * from user where email = ?";
    var inserts = [req.session.email];
    sql = mysql.format(sql, inserts);
    con.query(sql, function(err, results, fields){
      if(results.length < 0){
        req.session.reset();
        res.redirect('/login');
      }
      else{
        res.locals.email = results[0].email;
        res.locals.name = results[0].name;
        res.render('stats.jade');
      }
    });
  }
  else{
    res.redirect('/login');
  }
});

app.get('/logout', function(req, res){
  req.session.destroy();
  res.redirect('/');
});

var port = process.env.PORT || 3000;
http.listen(port, '127.0.0.1');
console.log("Server is listening on "+ port);

/*

io.sockets.connected[ socket.id ].emit('privateMsg', 'hello this is a private msg');

CREATE TABLE user (name CHAR(255), email VARCHAR(255) PRIMARY KEY, password VARCHAR(255));

CREATE TABLE countries (id INTEGER AUTO_INCREMENT PRIMARY KEY, country VARCHAR(255), capital  VARCHAR(255)); 

CREATE TABLE game (game_id INTEGER, email VARCHAR(255), CONSTRAINT PK_Game PRIMARY KEY (game_id, email)); 

CREATE TABLE stats(email VARCHAR(255) PRIMARY KEY, wins INTEGER, losses INTEGER);

CREATE TABLE gamescores (game_id INTEGER, email VARCHAR(255), q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER, q5 INTEGER, q6 INTEGER, q7 INTEGER, q8 INTEGER, q9 INTEGER, q10 INTEGER, FOREIGN KEY(game_id, email) REFERENCES game(game_id, email));

CREATE TABLE gamemoves (game_id INTEGER, email VARCHAR(255), a1 VARCHAR(255), a2 VARCHAR(255), a3 VARCHAR(255), a4 VARCHAR(255), a5 VARCHAR(255), a6 VARCHAR(255), a7 VARCHAR(255), a8 VARCHAR(255), a9 VARCHAR(255), a10 VARCHAR(255), FOREIGN KEY(game_id, email) REFERENCES game(game_id, email) );

CREATE TABLE gq (game_id INTEGER, id INTEGER, FOREIGN KEY(id) REFERENCES countries(id));

>>for stats page
SELECT a.name, b.wins, b.losses FROM user a JOIN stats b ON a.email = b.email;

>> for gamemoves page
// query needed
//select game_id,email,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10 from gamemoves where game_id in (select game_id from game where game_id in (select game_id from game where email='rob@gmail.com') and email!='rob@gmail.com');
*/

