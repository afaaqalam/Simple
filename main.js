var express = require('express');
var https = require('https');
var fs = require('fs');
var app = express();

var server = https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
},app);

var io = require('socket.io').listen(server);

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
  cookie: { maxAge: 600000, secure: true },
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
  //var sql = 'CREATE TABLE IF NOT EXISTS user (name CHAR(255), email VARCHAR(255) PRIMARY KEY, password VARCHAR(255)); CREATE TABLE IF NOT EXISTS countries (id INTEGER AUTO_INCREMENT, country VARCHAR(255), capital VARCHAR(255), PRIMARY KEY(id) ); CREATE TABLE IF NOT EXISTS stats(email VARCHAR(255) PRIMARY KEY, wins INTEGER, losses INTEGER); CREATE TABLE IF NOT EXISTS game (game_id INTEGER, email VARCHAR(255), CONSTRAINT PK_Game PRIMARY KEY (game_id, email)); CREATE TABLE IF NOT EXISTS gamescores (game_id INTEGER, email VARCHAR(255), q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER, q5 INTEGER, q6 INTEGER, q7 INTEGER, q8 INTEGER, q9 INTEGER, q10 INTEGER, FOREIGN KEY(game_id, email) REFERENCES game(game_id, email)); CREATE TABLE IF NOT EXISTS gamemoves (game_id INTEGER, email VARCHAR(255), a1 VARCHAR(255), a2 VARCHAR(255), a3 VARCHAR(255), a4 VARCHAR(255), a5 VARCHAR(255), a6 VARCHAR(255), a7 VARCHAR(255), a8 VARCHAR(255), a9 VARCHAR(255), a10 VARCHAR(255), FOREIGN KEY(game_id, email) REFERENCES game(game_id, email) ); CREATE TABLE IF NOT EXISTS gq (game_id INTEGER, id INTEGER, FOREIGN KEY(id) REFERENCES countries(id));';
  var sql = 'CREATE TABLE IF NOT EXISTS Users (name CHAR(255), email VARCHAR(255) PRIMARY KEY, password VARCHAR(255)); CREATE TABLE IF NOT EXISTS Countries (country_id INTEGER PRIMARY KEY, country VARCHAR(255), capital  VARCHAR(255)); CREATE TABLE IF NOT EXISTS Game (game_id INTEGER, email1 VARCHAR(255), email2 VARCHAR(255), CONSTRAINT PK_Game PRIMARY KEY (game_id)); CREATE TABLE IF NOT EXISTS Stats (email VARCHAR(255) PRIMARY KEY, wins INTEGER, losses INTEGER); CREATE TABLE IF NOT EXISTS GameScores (game_id INTEGER, email VARCHAR(255), question_no INTEGER, point INTEGER, FOREIGN KEY(game_id) REFERENCES Game(game_id)); CREATE TABLE IF NOT EXISTS GameMoves (game_id INTEGER, email VARCHAR(255), answer_no INTEGER, answer_attempt VARCHAR(255), FOREIGN KEY(game_id) REFERENCES Game(game_id)); CREATE TABLE IF NOT EXISTS GameQuestions (game_id INTEGER, country_id INTEGER, question_no INTEGER, FOREIGN KEY(country_id) REFERENCES Countries(country_id)); CREATE TABLE IF NOT EXISTS ResumeModel (email VARCHAR(255), game_id INTEGER, session_id VARCHAR(255), FOREIGN KEY(game_id) REFERENCES Game(game_id));';
  con.query(sql, function (err, result) {
    if (err) throw err;
    console.log("All tables created!");
  });
});

//Sleep function
function sleep(seconds){
  var waitUntil = new Date().getTime() + seconds*1000;
  while(new Date().getTime() < waitUntil) true;
};

//Socket Events
var AllGames = {};

//var countries = [1,2,3,4,5,6,7,8,9,10,11]; // remove countries from here
var c;
io.on('connection', function (socket) {
  console.log("User "+ socket.id + " connected"); 
  
  socket.on('disconnect', function(){
    setTimeout(function () {
      console.log("User "+ socket.id +" disconnected!");
    }, 10000);
  });

  var list = io.sockets.sockets; 
  console.log("Connected sockets:"); 
  Object.keys(io.sockets.sockets).forEach(function(id){ 
    console.log("ID: ",id);
  }); 

  socket.on('createGameRoom', function(data){
    var thisGameId = (Math.random() * 100000) | 0;
    var email = data.email;
    socket.emit('newGameRoomCreated', {gRoomId: thisGameId, mySocketId: socket.id, numPlayersInRoom: 1});
    console.log('GameRoomCreated: '+thisGameId+" user email: ");//+user);
    socket.join(thisGameId.toString());
    var numPlayersInRoom = 1;
    AllGames[thisGameId] = numPlayersInRoom;
    //db insert for above logic

    var sql = "INSERT INTO Game VALUES (?, ?, ?);";
    var inserts = [thisGameId, email, ''];
    sql = mysql.format(sql, inserts);
    con.query(sql,function(err){
      if(err){
        console.log("error creating Game record");
       } // handle else case with success code from SQL success codes.
    });
  });

  socket.on('listGameRooms', function(){
    console.log('sending AllGames to client..');
    socket.emit('sendGameRooms', AllGames);
    console.log('emitted sendGameRooms');  
  });

  socket.on('joinTo', function(content){
    var gRoomId = content.gRoomId;
    var email = content.email;
    socket.join(gRoomId);
    var info = {'gRoomId': gRoomId,'mySocketId': socket.id, 'numPlayersInRoom': 2};
    console.log('Joined '+gRoomId);
    console.log(info);
    AllGames[gRoomId] = 2;
    socket.emit('updateGameInfo', info);
    
    //write to db both players and game model and resume model
    var sql = "UPDATE Game SET email2 = (?) Where game_id = (?)";
    var inserts = [email, gRoomId];
    sql = mysql.format(sql, inserts);
    con.query(sql,function(err){
      if(err){
        console.log("error creating Game record");
       }
    });

    //fill countries for this game

    //var countries_id = Array.from({length: 11}, () => Math.floor(Math.random() * (10)));
    var countries_id = [76, 184, 185, 60, 82, 8, 64, 66, 84, 142, 11 ]
    for(var i=0; i < 10; i++){
      var sql = "INSERT INTO GameQuestions VALUES(?, ?, ?)";
      var inserts = [gRoomId, countries_id[i] , i];
      sql = mysql.format(sql, inserts);
        con.query(sql,function(err){
          console.log(err);
        });
      };
    
    
    console.log('emitted startTimer to GameRoom: '+gRoomId);
    io.to(gRoomId).emit('startTimer');
    //io.sockets.connected[content.sid].emit('takeAllCountries', countries);  
    console.log('emitted countries_id array to gRoom');
    io.to(gRoomId).emit('takeAllCountries', countries_id);
    //gameInit();
    //console.log('emitted startTimer to GameRoom: '+gRoomId);
    //io.to(gRoomId).emit('startTimer');
  });

  /*
  socket.on('getAllCountries', function(content){
    console.log("sent question to "+content.sid+' in gameRoomId: '+content.gRoomId);
    //var q = {'country': 'India'};
    //var countries = Array.from({length: 11}, () => Math.floor(Math.random() * (195)));
    // populate 10 random values in range(1-195) -> countries
    io.sockets.connected[content.sid].emit('takeAllCountries', countries);
  });*/

  socket.on('sendQuestion', function(data){
    //db updations now
    var gRoomId = data.gRoomId;
    var cId = data.countryId;
    var roundCount = data.roundCount;
    var socketid = data.sid;
    console.log("Received from "+socketid+" from gRoomId: "+gRoomId+" for round: "+roundCount+" for countryId: "+cId);
    
    var sql = "SELECT country FROM countries where country_id = ?;";
    var inserts = [cId];
    sql = mysql.format(sql, inserts);
    console.log('Country fetch query: '+sql);
    con.query(sql, function(err, results, field){
      if(err){
        console.log(err);
      }
      c = results[0].country;
      console.log("results value from sql db: "+c);
      var question = {'country': c};
      console.log("sent country: "+c+" to socketid: "+socketid);
      io.sockets.connected[socketid].emit('takeQuestion', question);
    });
  });

  socket.on('checkAnswer', function(answer){
    var answeredCapital = answer.myAns;
    var askedCountry = answer.country;
    var socketid = answer.sid;
    var nextId = answer.nextId;
    var pEmail = answer.email;
    var point = answer.point
    var round = answer.round;
    var gRoomId = answer.gRoomId;
    var sql = "SELECT capital from countries where country = ?;";
    var inserts = [askedCountry];
    sql = mysql.format(sql, inserts);
    console.log("query: "+sql);
    con.query(sql, function(err, results, fields){
      console.log(results[0]);
      if(err){
        console.log(err);
      }
        
      else{
        if( answeredCapital.toLowerCase() === results[0].capital.toLowerCase() ){
          console.log("correct answer!");
          point += 1;
          //update db scores and other dependencies here. or below
          io.sockets.connected[socketid].emit('questionResult', {"point": point});
          // sleep(1);
          // update db with the attempt from client

          var sql = "INSERT INTO GameMoves VALUES(?, ?, ?, ?)";
          var inserts = [gRoomId, pEmail , round, answeredCapital];
          sql = mysql.format(sql, inserts);
          con.query(sql,function(err){
            console.log(err);
          });

          // update db with scores of email
          var sql = "INSERT INTO GameScores VALUES(?, ?, ?, ?)";
          var inserts = [gRoomId, pEmail , round, 1];
          sql = mysql.format(sql, inserts);
          con.query(sql,function(err){
            console.log(err);
          });

          // increment score for socketid received
          // DONE : emit that answer was correct  
          // DONE : emit new question without wait
          // DONE : select country from db for nextId countryId.
          // DONE : setInterval for 2 seconds and then emit takeQuestion
          if(round === 9){
            console.log('sendGame to be emitted!');
            io.sockets.connected[socketid].emit('sendGameData');   //uncomment!!! 
          }
          else{
            var sql = "SELECT country from countries where country_id = ?;";
            var inserts = [nextId];
            sql = mysql.format(sql, inserts);
            console.log("query: "+sql);
            con.query(sql, function(err, results, fields){
              if(err){
                console.log(err);
              }
              console.log('nextCountry: '+results[0].country);
              io.sockets.connected[socketid].emit('takeQuestion', {'country':results[0].country});    
            });  
          }
          /*var sql = "SELECT country from countries where id = ?;";
          var inserts = [nextId];
          sql = mysql.format(sql, inserts);
          console.log("query: "+sql);
          con.query(sql, function(err, results, fields){
            if(err){
              console.log(err);
            }
            console.log('nextCountry: '+results[0].country);
            io.sockets.connected[socketid].emit('takeQuestion', {'country':results[0].country});    
          });*/
        } 
        else{
          console.log("wrong answer!");
          io.sockets.connected[socketid].emit('questionResult', {"point": point});
          // update db with attempt

          var sql = "INSERT INTO GameMoves VALUES(?, ?, ?, ?)";
          var inserts = [gRoomId, pEmail , round, answeredCapital];
          sql = mysql.format(sql, inserts);
          con.query(sql,function(err){
            if(err){
              console.log(err);      
            }
          });

          var sql = "INSERT INTO GameScores VALUES(?, ?, ?, ?)";
          var inserts = [gRoomId, pEmail , round, 0];
          sql = mysql.format(sql, inserts);
          con.query(sql,function(err){
            if(err){
              console.log(err);
            }  
          });

          if(round === 9){
            console.log('asked for gameData');
            io.sockets.connected[socketid].emit('sendGameData');   //uncomment!!! 
          }
          else{
            var sql = "SELECT country from countries where country_id = ?;";
            var inserts = [nextId];
            sql = mysql.format(sql, inserts);
            console.log("query: "+sql);
            con.query(sql, function(err, results, fields){
              if(err){
                console.log(err);
              }
              console.log('nextCountry: '+results[0].country);
  
              io.sockets.connected[socketid].emit('takeQuestion', {'country':results[0].country});
            });  
          }
          /*var sql = "SELECT country from countries where id = ?;";
          var inserts = [nextId];
          sql = mysql.format(sql, inserts);
          console.log("query: "+sql);
          con.query(sql, function(err, results, fields){
            if(err){
              console.log(err);
            }
            console.log('nextCountry: '+results[0].country);

            io.sockets.connected[socketid].emit('takeQuestion', {'country':results[0].country});
          });*/
        }  
      }
    });
  });

  socket.on('takeGameData', function(content){
    var gRoomId = content.gRoomId;
    var email = content.email;
    var socketId = content.socketId;
    // db fetch if for the same gRoomId and email other than specified, check if the 9th round's point is 
    // updated (which means find out if the other player finsihed before you)
    var sql = "SELECT Count(*) AS num FROM GameScores WHERE email <> (?) AND game_id = (?)";
    var inserts = [email, gRoomId];
    sql = mysql.format(sql, inserts);
    console.log("query: "+sql);
    con.query(sql, function(err, results){
      if(err){
        console.log(err);
      }
      if(10 - results[0].num === 0){
        console.log('you are second one to finish');
        //fetch total for both players from game room
        var sql = "SELECT email, sum(point) point FROM GameScores WHERE game_id = (?) group by email;";
        var inserts = [gRoomId];
        sql = mysql.format(sql, inserts);
        con.query(sql, function(err, results){
          if(err){
            console.log(err);
          }
            
          var p1 = results[0].email;
          var p1Score = results[0].point;
          var p2 = results[1].email;
          var p2Score = results[1].point;
          if(p1Score > p2Score){
            var decision = {"Won": p1, "Won-Total": p1Score, "Lost": p2, "Lost-Total":p2Score};

            var sql = "UPDATE Stats Set wins = wins + 1 WHERE email = (?)"; 
            var inserts = [p1];
            sql = mysql.format(sql, inserts);
            con.query(sql, function(err){
              if(err){
                console.log(err);
              }
            });  
          
            var sql = "UPDATE Stats Set losses = losses + 1 WHERE email = (?)"; 
            var inserts = [p2];
            sql = mysql.format(sql, inserts);
            con.query(sql, function(err){
              if(err){
                console.log(err);
              }
            });    
          }
          
          else{
            var decision = {"Won": p2, "Won-Total": p2Score, "Lost": p1, "Lost-Total":p1Score};
          
            var sql = "UPDATE Stats Set wins = wins + 1 WHERE email = (?)"; 
            var inserts = [p2];
            sql = mysql.format(sql, inserts);
            con.query(sql, function(err){
              if(err){
                console.log(err);
              }
            });  
          
            var sql = "UPDATE Stats Set losses = losses + 1 WHERE email = (?)"; 
            var inserts = [p1];
            sql = mysql.format(sql, inserts);
            con.query(sql, function(err){
              if(err){
                console.log(err);
              }
            });
          }

          io.to(gRoomId).emit('takeFinalResult', decision);
          
        });
      }
      else{
        console.log('you finished first');
        //emit to wait till other player finishes. 
        io.sockets.connected[socketId].emit('waitForResult');
      }
    });

    //fetch COMPLETE game DETAILS of both player from db
    //emit to gRoomId: who won? and all the data
    //}
  });

//more emits and listeners go here.
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

  var sql = "INSERT INTO Stats VALUES(?, ?, ?)";
  var inserts = [req.body.email, 0, 0];
  sql = mysql.format(sql, inserts);
  con.query(sql, function(err){
    console.log(err);
  });

  if(errors){
    console.log(errors);
    return res.render('register.jade', {error: errors});
  }

  bcrypt.hash(req.body.password, 11, function(err, hPassword){
    if(err){
      console.log(err);
    }
    var sql = "INSERT INTO users VALUES(?, ?, ?)";
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
    var sql = "SELECT * from users where email = ?";
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

  var sql = "SELECT * FROM users WHERE email = ?";
  var inserts = [req.body.email];
  sql = mysql.format(sql,inserts);
  console.log("login query: ",sql);
  con.query(sql, function(err, results, fields){
    if(err){
      console.log(err);
      return res.render('login.jade', {error:'Invalid email or password!'});
    }
    else{
      console.log('no error, checking results length, results.length: '+results.length);
      if(results.length > 0){
        bcrypt.compare(req.body.password, results[0].password, function(err, fin){
          if(!fin){
            console.log('passwords do not match');
            return res.render('login.jade',{error: 'Invalid email or password!'});
          }
          console.log('passwords match');
          req.session.email = req.body.email;
          req.session.name = results[0].name;
          return res.redirect('/dashboard');
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
    var sql = "SELECT * from users where email = ?";
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
    var sql = "SELECT * from users where email = ?";
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
server.listen(port);
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

