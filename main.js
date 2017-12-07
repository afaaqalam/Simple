var express = require('express');
var https = require('https');
var fs = require('fs');
var app = express();

var server = https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
},app);

var io = require('socket.io').listen(server);

var helmet = require('helmet');
var csrf = require('csurf');
var bodyParser = require('body-parser');
//var mongoose = require('mongoose');
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
  cookie: { 
    maxAge: 600000, 
    secure: true,
    httpOnly: true 
  },
}));
app.use(helmet());
app.use(helmet.noCache());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'",'wss://localhost:3000'],
    styleSrc: ["'self'","'unsafe-inline'"],
  }, setAllHeaders: true,
}));
app.use(helmet.referrerPolicy({ policy: 'same-origin' }));
//app.use(csrf());

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
  var sql = 'CREATE TABLE IF NOT EXISTS Users (name CHAR(255), email VARCHAR(255) PRIMARY KEY, password VARCHAR(255)); CREATE TABLE IF NOT EXISTS Countries (country_id INTEGER PRIMARY KEY, country VARCHAR(255), capital  VARCHAR(255)); CREATE TABLE IF NOT EXISTS Game (game_id INTEGER, email1 VARCHAR(255), email2 VARCHAR(255), CONSTRAINT PK_Game PRIMARY KEY (game_id)); CREATE TABLE IF NOT EXISTS Stats (email VARCHAR(255) PRIMARY KEY, wins INTEGER, losses INTEGER); CREATE TABLE IF NOT EXISTS GameScores (game_id INTEGER, email VARCHAR(255), question_no INTEGER, point INTEGER, FOREIGN KEY(game_id) REFERENCES Game(game_id)); CREATE TABLE IF NOT EXISTS GameMoves (game_id INTEGER, email VARCHAR(255), answer_no INTEGER, answer_attempt VARCHAR(255), FOREIGN KEY(game_id) REFERENCES Game(game_id)); CREATE TABLE IF NOT EXISTS GameQuestions (game_id INTEGER, country_id INTEGER, question_no INTEGER, FOREIGN KEY(country_id) REFERENCES Countries(country_id));';
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
var globalStats = [];

var c;
io.on('connection', function (socket) {
  console.log("User "+ socket.id + " connected"); 

  io.sockets.connected[socket.id].emit('takeStats', globalStats);
  
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
    socket.emit('newGameRoomCreated', {'gRoomId': thisGameId, 'mySocketId': socket.id, 'numPlayersInRoom': 1});
    console.log('GameRoomCreated: '+thisGameId+" user email: ");
    socket.join(thisGameId.toString());
    //var numPlayersInRoom = 1;
    AllGames[thisGameId] = 1;
    //db insert for above logic

    var sql = "INSERT INTO Game VALUES (?, ?, ?);";
    var inserts = [thisGameId, email, ''];
    sql = mysql.format(sql, inserts);
    con.query(sql,function(err){
      if(err){
        console.log("error creating Game record");
       } // handle else case with success code from SQL success codes.
    });

    for(var i=0; i < 10; i++){
      var sql = "INSERT INTO GameMoves(game_id, email, answer_no) VALUES(?, ?, ?)";
      var inserts = [thisGameId, email , i];
      sql = mysql.format(sql, inserts);
      con.query(sql,function(err){
        if(err){
          console.log(err);      
        }
      });
    };
  });

  socket.on('imBack',function(data){
    socket.join(data.gRoomId);
    io.to(data.gRoomId).emit('startTimer2');
  });

  socket.on('sendGameHistory', function(data){
    var email = data.email;
    var socketId = data.socketId;
    
    var sql = "SELECT DISTINCT d.answer_no AS 'Questions', c.country AS 'Country', c.capital AS 'CorrectAnswer', f.name AS 'Player1', d.answer_attempt AS 'Player1-Answer', h.point AS 'Player1-Points', g.name AS 'Player2', e.answer_attempt AS 'Player2-Answer', i.point AS 'Player2-Points' FROM Game a LEFT OUTER JOIN GameQuestions b ON a.game_id = b.game_id LEFT OUTER JOIN Countries c ON b.country_id = c.country_id LEFT OUTER JOIN GameMoves d ON (a.game_id = d.game_id) AND (a.email1 = d.email) AND (d.answer_no = b.question_no) LEFT OUTER JOIN GameMoves e ON (a.game_id = e.game_id) AND (a.email2 = e.email) AND (e.answer_no = b.question_no) LEFT OUTER JOIN GameScores h ON (a.game_id = h.game_id) AND (a.email1 = h.email) AND (d.answer_no = h.question_no) LEFT OUTER JOIN GameScores i ON (a.game_id = i.game_id) AND (a.email2 = i.email) AND (d.answer_no = i.question_no) LEFT OUTER JOIN Users f ON d.email = f.email AND f.email = a.email1 LEFT OUTER JOIN Users g ON e.email = g.email AND g.email = a.email2 WHERE a.game_id IN (SELECT game_id FROM Game WHERE (game_id IS NOT NULL) AND (email1 = (?) OR email2 = (?)));";
    var inserts = [email, email];
    sql = mysql.format(sql, inserts);
    console.log("query gameHistory: "+sql);
    con.query(sql, function(err, results){
      if(err){
        console.log(err);
      }
      console.log(JSON.stringify(results));
      //io.sockets.connected[socket.id].emit('takeGameHistory', JSON.stringify(results));
      socket.emit('takeGameHistory', JSON.stringify(results));
      console.log("emitted takeGameHistory");  
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
    var info = {
                  'gRoomId': gRoomId,
                  'mySocketId': socket.id, 
                  'numPlayersInRoom': 2, 
                  'roundCount': 0, 
                  'resume':0
                };
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
    
    //var countries_id = Array.from({length: 11}, () => Math.floor(Math.random() * (10)));
    var countries_id = [76, 184, 185, 60, 82, 8, 64, 66, 84, 142, 11 ]
    for(var i=0; i < 10; i++){
      var sql = "INSERT INTO GameQuestions VALUES(?, ?, ?)";
      var inserts = [gRoomId, countries_id[i] , i];
      sql = mysql.format(sql, inserts);
      con.query(sql,function(err){
        if(err){
          console.log(err);
        }
      });
    };
    
    for(var i=0; i < 10; i++){
      var sql = "INSERT INTO GameMoves(game_id, email, answer_no) VALUES(?, ?, ?)";
      var inserts = [gRoomId, email , i]; //last param removed
      sql = mysql.format(sql, inserts);
      con.query(sql,function(err){
        if(err){
          console.log(err);      
        }
      });
    };
    
    console.log('emitted startTimer to GameRoom: '+gRoomId);
    io.to(gRoomId).emit('startTimer');
    //io.sockets.connected[content.sid].emit('takeAllCountries', countries);  
    console.log('emitted countries_id array to gRoom');
    io.to(gRoomId).emit('takeAllCountries', countries_id);
    //console.log('emitted startTimer to GameRoom: '+gRoomId);
    //io.to(gRoomId).emit('startTimer');
  });

  socket.on('cResumeGame', function(data){
    var email = data.email;
    //socket.emit('updateGameInfo', info);
    console.log("emitting resumeTest event!");
    //socket.emit('resumeTest', 'hello');
    io.sockets.connected[socket.id].emit('resumeTest', 'hello');  

    io.sockets.emit("pauseGame", email);

    //DOne:  modify insert statements to update statements for gamemoves!
    // to get the gRoomId, SELECT game_id from gamemoves where email='<email>' AND (answer_no =9 AND answer_attempt= NULL)
    var sql = "SELECT game_id from GameMoves WHERE email= (?) AND (answer_no = 9 AND answer_attempt IS NULL)";
    var inserts = [email];
    var eGRoomId;
    sql = mysql.format(sql, inserts);
    console.log("query1: "+sql);
          con.query(sql,function(err, results){
            if(err){
              console.log(err);      
            }
            eGRoomId = results[0].game_id;
            console.log("(1) the value inside eGRoomId: "+eGRoomId);

            console.log("(2)the value inside eGRoomId: "+eGRoomId);
            var sql = "SELECT MAX(question_no) AS rcount FROM GameScores WHERE email = (?) AND game_id = (?)";
            var inserts = [email, eGRoomId];
            var eRoundCount;
            sql = mysql.format(sql, inserts);
            console.log("query2: "+sql);
            console.log(sql);
                  con.query(sql,function(err, results){
                    if(err){
                      console.log(err);      
                    }
                    eRoundCount = results[0].rcount;
                    console.log("eRoundCount: "+eRoundCount);
            });

            console.log("(3)the value inside eGRoomId: "+eGRoomId);
            var sql = "SELECT country_id from GameQuestions WHERE game_id = (?)";
            var inserts = [eGRoomId];
            sql = mysql.format(sql, inserts);
            console.log("query3: "+sql);
                  con.query(sql,function(err, results){
                    if(err){
                      console.log(err);      
                    }
                    var eCountries_id = [];
                    for(var i=0; i<10; i++){
                      eCountries_id.push(results[i].country_id);
                    }
                    console.log(eCountries_id);
                    console.log(JSON.stringify(results));

                    io.sockets.connected[socket.id].emit('takeAllCountries', eCountries_id);
                    var eApp = {
                                  "mySocketId": socket.id,
                                  "gRoomId": eGRoomId,
                                  "roundCount": eRoundCount+1,
                                  "numPlayersInRoom": 2,
                                  "resume": 1
                    };
                    console.log(eApp);
                    io.sockets.connected[socket.id].emit('updateGameInfo', eApp);


            });
    });

    /*
    console.log("(2)the value inside eGRoomId: "+eGRoomId);
    var sql = "SELECT MAX(question_no) AS rcount FROM GameScores WHERE email = (?) AND game_id = (?)";
    var inserts = [email, eGRoomId];
    var eRoundCount;
    sql = mysql.format(sql, inserts);
          con.query(sql,function(err, results){
            if(err){
              console.log(err);      
            }
            eRoundCount = results[0].rcount;
            console.log("eRoundCount: "+eRoundCount);
    });*/

    /*console.log("(3)the value inside eGRoomId: "+eGRoomId);
    var countries_id = "SELECT country_id from GameQuestions WHERE game_id = (?)";
    var inserts = [eGRoomId];
    sql = mysql.format(sql, inserts);
          con.query(sql,function(err, results){
            if(err){
              console.log(err);      
            }
            console.log(JSON.toString(results));
    });*/

    // draw gameId
    //now, select max(Question-no) from gamescores where email=<email> and game_id=<gamedID from top>
    // 
    // emit => var countries_id = select countries_id from gamequestions where gameId=<gameid from top>
    // socket.emit('takeAllCountries', countries_id);
    /* App {
      gRoomId:
      mySocketId:
      numPlayersInRoom
      roundCount: COUNT IN QUERY 2 + 1
        

    } 
    */
  });

  socket.on('sendQuestion', function(data){
    var gRoomId = data.gRoomId;
    console.log("-->"+data.gRoomId);
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

          // update db with scores of email
          var sql = "INSERT INTO GameScores VALUES(?, ?, ?, ?)";
          var inserts = [gRoomId, pEmail , round, 1];
          sql = mysql.format(sql, inserts);
          con.query(sql,function(err){
            if(err){
              console.log(err);
            }
          });

          var sql = "UPDATE GameMoves Set answer_attempt = (?) WHERE game_id = (?) AND email = (?) AND answer_no = (?)";
          var inserts = [answeredCapital, gRoomId , pEmail, round];
          sql = mysql.format(sql, inserts);
          con.query(sql,function(err){
            if(err){
              console.log(err);
            }
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

          var sql = "INSERT INTO GameScores VALUES(?, ?, ?, ?)";
          var inserts = [gRoomId, pEmail , round, 0];
          sql = mysql.format(sql, inserts);
          con.query(sql,function(err){
            if(err){
              console.log(err);
            }  
          });

          var sql = "UPDATE GameMoves Set answer_attempt = (?) WHERE game_id = (?) AND email = (?) AND answer_no = (?)";
          var inserts = [answeredCapital, gRoomId , pEmail, round];
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
    //console.log("query: "+sql);
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
          console.log('Player1: '+p1+" score: "+p1Score+" Player2: "+p2+" score: "+p2Score);
          if(p1Score > p2Score){
            /*var decision = {  "Player": p1, "Decision": "Won", "Total": p1Score, 
                              "Player": p2, "Decision": "Lost", "Total": p2Score
                            };*/
            var decision = [  {
                                  "Player": p1, "Decision": "Won", "Total": p1Score
                              },
                              {
                                  "Player": p2, "Decision": "Lost", "Total":p2Score
                              }  
                            ];                
            console.log(decision);

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
            
            //here
            
          }
          
          else{
            var decision = [  {
                                  "Player": p2, "Decision": "Won", "Total": p2Score
                              },
                              {
                                  "Player": p1, "Decision": "Lost", "Total":p1Score
                              }  
                            ];
          console.log(decision);
            //update stats wins
            var sql = "UPDATE Stats Set wins = wins + 1 WHERE email = (?)"; 
            var inserts = [p2];
            sql = mysql.format(sql, inserts);
            con.query(sql, function(err){
              if(err){
                console.log(err);
              }
            });  
          
            //update stats losses
            var sql = "UPDATE Stats Set losses = losses + 1 WHERE email = (?)"; 
            var inserts = [p1];
            sql = mysql.format(sql, inserts);
            con.query(sql, function(err){
              if(err){
                console.log(err);
              }
            });

            /*var sql = "SELECT DISTINCT d.answer_no AS 'Questions', c.country AS 'Country', c.capital AS 'Correct Answer', f.name AS 'Player 1', d.answer_attempt AS 'Player 1 Answer', h.point AS 'Player 1 Points', g.name AS 'Player 2', e.answer_attempt AS 'Player 2 Answer', i.point AS 'Player 2 Points' FROM Game a LEFT OUTER JOIN GameQuestions b ON a.game_id = b.game_id LEFT OUTER JOIN Countries c ON b.country_id = c.country_id LEFT OUTER JOIN GameMoves d ON (a.game_id = d.game_id) AND (a.email1 = d.email) AND (d.answer_no = b.question_no) LEFT OUTER JOIN GameMoves e ON (a.game_id = e.game_id) AND (a.email2 = e.email) AND (e.answer_no = b.question_no) LEFT OUTER JOIN GameScores h ON (a.game_id = h.game_id) AND (a.email1 = h.email) AND (d.answer_no = h.question_no) LEFT OUTER JOIN GameScores i ON (a.game_id = i.game_id) AND (a.email2 = i.email) AND (d.answer_no = i.question_no) LEFT OUTER JOIN Users f ON d.email = f.email AND f.email = a.email1 LEFT OUTER JOIN Users g ON e.email = g.email AND g.email = a.email2 WHERE a.game_id = (?)";
            var inserts = [gRoomId];
            sql = mysql.format(sql, inserts);
            console.log("query: "+sql);
            con.query(sql, function(err, results){
              if(err){
                console.log(err);
              }
              console.log(JSON.stringify(results));
              //socket.emit('takeFinalResult', {'decision':decision, 'summary': JSON.stringify(results)});
            });*/
          }

          var sql = "SELECT a.name, b.wins, b.losses FROM Users a JOIN Stats b ON a.email = b.email;";
          con.query(sql, function(err, results){
            if(err){
              console.log(err);
            }
            //console.log(JSON.stringify(results));
            globalStats = JSON.stringify(results);
            console.log(globalStats);
            socket.emit('takeStats', globalStats);
            console.log("emitted global stats");
            //io.sockets.connected[socket.id].emit('takeStats', results);
            //console.log("emitting takeStats");  
          });

          //io.to(gRoomId).emit('takeFinalResult', decision);
          //
          var sql = "SELECT DISTINCT d.answer_no AS 'Questions', c.country AS 'Country', c.capital AS 'CorrectAnswer', f.name AS 'Player1', d.answer_attempt AS 'Player1-Answer', h.point AS 'Player1-Points', g.name AS 'Player2', e.answer_attempt AS 'Player2-Answer', i.point AS 'Player2-Points' FROM Game a LEFT OUTER JOIN GameQuestions b ON a.game_id = b.game_id LEFT OUTER JOIN Countries c ON b.country_id = c.country_id LEFT OUTER JOIN GameMoves d ON (a.game_id = d.game_id) AND (a.email1 = d.email) AND (d.answer_no = b.question_no) LEFT OUTER JOIN GameMoves e ON (a.game_id = e.game_id) AND (a.email2 = e.email) AND (e.answer_no = b.question_no) LEFT OUTER JOIN GameScores h ON (a.game_id = h.game_id) AND (a.email1 = h.email) AND (d.answer_no = h.question_no) LEFT OUTER JOIN GameScores i ON (a.game_id = i.game_id) AND (a.email2 = i.email) AND (d.answer_no = i.question_no) LEFT OUTER JOIN Users f ON d.email = f.email AND f.email = a.email1 LEFT OUTER JOIN Users g ON e.email = g.email AND g.email = a.email2 WHERE a.game_id = (?)";
          var inserts = [gRoomId];
          sql = mysql.format(sql, inserts);
          //console.log("query: "+sql);
          con.query(sql, function(err, results){
            if(err){
              console.log(err);
            }
            //console.log(JSON.stringify(results));
            io.to(gRoomId).emit('takeFinalResult', {'decision':decision, 'summary': JSON.stringify(results)});
          });  
        });
        
        
      
      
      }
      else{
        console.log('you finished first');
        //emit to wait till other player finishes. 
        io.sockets.connected[socketId].emit('waitForResult');
      }
    });

    
    
    
  });

//more emits and listeners go here.
});


//Routes

app.get('/', function(req,res){
  res.render('index.jade');
});

app.get('/register', function(req, res){
  //res.locals.csrftoken = req.csrfToken();
  //res.locals.csrfToken = req.csrfToken();
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
    if(err){
      console.log(err);
    }
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
        //res.locals.csrfToken = req.csrfToken();
        res.render('/login');
      }
      else{
        res.locals.email = results[0].email;
        res.locals.name = results[0].name;
        res.render('dashboard.jade');
      }
    });
  }
  else {
  //res.locals.csrfToken = req.csrfToken();  		
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

  var sql = "SELECT a.name, b.wins, b.losses FROM Users a JOIN Stats b ON a.email = b.email;";
  con.query(sql, function(err, results){
    if(err){
      console.log(err);
    }
    //console.log(JSON.stringify(results));
    globalStats = JSON.stringify(results);
    console.log(globalStats);
    //io.sockets.connected[socket.id].emit('takeStats', results);
    //console.log("emitting takeStats");  
  });

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
