var http		= require('http');
var url 		= require('url');
var connect 	= require('connect');
var bodyParser 	= require('body-parser');
var cors 		= require('cors');
var corsOpts 	= { origin: '*' };
var app 		= connect();
var mysql 		= require('mysql');
var connection 	= mysql.createConnection ({
  	host     	: 'localhost',
  	user     	: 'up201305217',
  	password 	: 'segredo',
  	database 	: 'up201305217'
});
var Chance = require('chance');
var chance = new Chance();
var crypto = require('crypto');

var games = [];
var playing = [];
var gamesAmount = 0;
var dir = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/*
var games = {
	1 : {id : 1, playerone : pedroo21, playertwo : null, level : beginner}
}

Entra um jogador -> verificar se existe jogo -> enviar SSE para os dois
Entra um jogador -> não existe jogo
	-> esperar até que o evento join acorde o update para enviar SSE (se for msm level)
Guardar jogadores em espera numa lista, por exemplo
UPDATE SÓ CONECTA DEPOIS DO JOIN -> Wakeups só após
- Usar MYSQL Pooling dos slides?
- Timeout para os games
*/

/*
******************************
    Conexão à base de dados    
******************************
*/

connection.connect(function(err){
	if(!err) {
	    console.log("Connected sucessfully with database...");    
	} else {
	    console.log("Error connecting to database: " + connection.host + "...");    
	}
});
 
app.use(bodyParser.urlencoded({ extended: false })) 
	.use(bodyParser.json()) // JSON
	.use(cors(corsOpts))
	.use('/register', registerMiddleware)
	.use('/ranking', rankingMiddleware)
	.use('/score', scoreMiddleware)
	.use('/join', joinMiddleware)
	//.use('/notify', notifyMiddleware)
	.use('/leave', leaveMiddleware)
	.use('/update', updateMiddleware)

var server = http.createServer(app);

server.listen(8030);

function registerMiddleware(req, res) {
	res.setHeader('Content-Type', 'application/json');
	var data = {};
	if(err = verifyJSON(req.body, ["name", "pass"])) {
		data.error = err;
		res.end(JSON.stringify(data));
	}
	else 
		SQLQuery(res, req, 'SELECT * FROM Users WHERE name = ?', [req.body.name], registerCB);
}

function rankingMiddleware(req, res) {
	res.setHeader('Content-Type', 'application/json');
	var data = {};
	if(err = verifyJSON(req.body, ["level"])) {
		data.error = err;
		res.end(JSON.stringify(data));
	}
	else 
		SQLQuery(res, req, 'SELECT * FROM Rankings WHERE level = ? ORDER BY score DESC, timestamp ASC LIMIT 10', [req.body.level], rankingCB);
}

function scoreMiddleware(req, res) {
	res.setHeader('Content-Type', 'application/json');
	var data = {};
	if(err = verifyJSON(req.body, ["name", "level"])) {
		data.error = err;
		res.end(JSON.stringify(data));
	}
	else 
		SQLQuery(res, req, 'SELECT * FROM Rankings WHERE name = ? AND level = ?', [req.body.name, req.body.level], scoreCB);
}

function joinMiddleware(req, res) {
	res.setHeader('Content-Type', 'application/json');
	var data = {};
	if(err = verifyJSON(req.body, ["group", "name", "pass", "level"])) {
		data.error = err;
		res.end(JSON.stringify(data));
	}
	else {
		SQLQuery(res, req, 'SELECT * FROM Users WHERE name = ?', [req.body.name], joinCB);
	}
}

function leaveMiddleware(req, res) {
	res.setHeader('Content-Type', 'application/json');
	var data = {};
	if(err = verifyJSON(req.body, ["name", "key", "game"])) {
		data.error = err;
	}
	else {
		for(var i in games) {
			if(games[i].id == req.body.game) {
				var hash = crypto.createHash('md5').update(data.game + games[i].playerone.name).digest('hex');
				if(games[i].playerone.name == req.body.name && hash == req.body.key) games.splice(i, 1);
				else data.error = "Authentication failed for game id " + req.body.name;
				break;
			}
		}
		if(!gameFound) // leave not allowed in state \"ongoing\" (only in state \"waiting\") - Não me parece necessário
			data.error = "Non existing game id " + req.body.name;
	}
	res.end(JSON.stringify(data));
}

function notifyMiddleware(req, res) {
	res.setHeader('Content-Type', 'application/json');
	var data = {};
	if(err = verifyJSON(req.body, ["name", "key", "game", "row", "col"])) {
		data.error = err;
		res.end(JSON.stringify(data));
	}
	else { // tomar banho xD

	}
}

function updateMiddleware(req, res) {
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('Transfer-Encoding', 'chunked');
	res.setHeader('Cache-Control', 'no-cache');
	console.log("Received");
	var data = {};
	//if(err = verifyJSON(req.body, ["name", "key", "game"])) {
	//	data.error = err;
	//}
	//else {
		var parse = url.parse(req.url, true).query;
		console.log(parse.name);
		for(var i in games) {
			if(games[i].id == parse.game) {
				var hash1 = crypto.createHash('md5').update((games[i].id + games[i].playerone.name).toString()).digest('hex');
				var hash2 = crypto.createHash('md5').update((games[i].id + games[i].playertwo.name).toString()).digest('hex');
				if(games[i].playerone.name == parse.name && hash1 == parse.key) {
					games[i].playerone.res = res;
				}
				else if(games[i].playertwo.name == parse.name && hash2 == parse.key) {
					games[i].playertwo.res = res;
					console.log("playertwo");
					if(games[i].playertwo.answer) wakeUpSSE(games[i], 2);
				}
				else data.error = "Authentication failed for game id " + parse.game;
				console.log(parse.key);
				break;
			}
		}
	//}
	//res.end(JSON.stringify(data));
}

function SQLQuery(res, req, query, params, callback) {
	connection.query(query, params, function(err, result) {
        if (err) { callback(err, res, req, null); return; }

        callback(null, res, req, result);
    });
}

/*
******************************
          Callbacks    
******************************
*/

function joinCB(err, res, req, result) {
	var data = {};
	var salt = result[0].salt; // TODO: ERROR User not found
	var hash = crypto.createHash('md5').update(req.body.pass + salt).digest('hex');
	if(hash != result[0].pass) {
		data.error = "Authentication error.";
		res.end(JSON.stringify(data));
		return;
	}
	var gameFound = false;
	for(var i in games) {
		if(!(games[i].group == parseInt(req.body.group) && games[i].level == req.body.level)) 
			continue;
		if(games[i].playerone.name == req.body.name) { data.error = "Cannot play against yourself, cheater!"; break; }
		else {
			gameFound = true;
			var game = games.splice(i, 1)[0];
			game.playertwo.name = req.body.name;
			game.board = makeBoard(req.body.level);
			data.game = game.id;
			data.key = crypto.createHash('md5').update(data.game + req.body.name).digest('hex');
			playing.push(game);
			// Wake up SSE for player 1, wait for player 2 to update
			// join, entra pl 2, fila warning pl 1 & wakeup, fila warning pl 2 (wait for connect)
			// requestQueue.push({game : game.id, answer : JSON.stringify({"opponent" : game.playertwo.name, "turn" : game.turn})});
			game.playerone.answer = JSON.stringify({"opponent" : game.playertwo.name, "turn" : getTurn(game)});
			game.playertwo.answer = JSON.stringify({"opponent" : game.playertwo.name, "turn" : getTurn(game)});
			wakeUpSSE(game, 1);
			break;
		}
	}
	if(!gameFound) {
		games.push(new Game(gamesAmount, parseInt(req.body.group), req.body.name, req.body.level));
		data.game = gamesAmount;
		data.key = crypto.createHash('md5').update(data.game + req.body.name).digest('hex');
		gamesAmount++;
	}
	res.end(JSON.stringify(data));
}

function wakeUpSSE(game, player) { // Ver se não existem memory leaks, falta o end
	if(player == 1) {
		game.playerone.res.write("data: " + game.playerone.answer + "\n\n");
		console.log("Sending to " + game.playerone.answer);
		game.playerone.answer = null;
	}
	else {
		game.playertwo.res.write("data: " + game.playertwo.answer + "\n\n");
		console.log("Sending to " + game.playertwo.answer);
		game.playertwo.answer = null;
	}
}

function registerCB(err, res, req, result) {
	var data = {};
	if(err) { 
		data.error = "Query error"; 
		console.log(err);
		res.end(JSON.stringify(data));
		return; 
	}
	if(result.length == 0) {
		var salt = chance.string({length: 4});
		var hash = crypto.createHash('md5').update(req.body.pass + salt).digest('hex');
		SQLQuery(res, req, 'INSERT INTO Users VALUES(?,?,?)', [req.body.name, hash, salt], emptyCB);
	}
	else {
		var salt = result[0].salt;
		var hash = crypto.createHash('md5').update(req.body.pass + salt).digest('hex');
		if(hash != result[0].pass)
			data.error = "User " + req.body.name + " registered with different password.";
		res.end(JSON.stringify(data));
	}
}

function emptyCB(err, res, req, result) {
	var data = {};
	if(err) {
		data.error = "Query error"; 
		console.log(err);
		res.end(JSON.stringify(data));
		return; 
	}
	res.end(JSON.stringify(data));
	return;
}

function rankingCB(err, res, req, result) {
	var data = {};
	if(err) { 
		data.error = "Query error"; 
		console.log(err);
		res.end(JSON.stringify(data));
		return; 
	}
	data.ranking = [];
	for(var i=0; i<result.length; i++) {
		data.ranking.push({ name : result[i].name, score : result[i].score});
	}
	res.end(JSON.stringify(data));
}

function scoreCB(err, res, req, result) {
	var data = {};
	if(err) { 
		data.error = "Query error"; 
		console.log(err);
		res.end(JSON.stringify(data));
		return; 
	}
	if(result.length == 0) data.score = 0;
	else data.score = result[0].score;
	res.end(JSON.stringify(data));
}

/*
******************************
      Funções do Cliente    
******************************
*/

function makeBoard(level) {
	switch(level) {
		case "beginner":
			var ROWS = 9, COLS = 9, bombsAmount = 10;
			break;
		case "intermediate":
			var ROWS = 16, COLS = 16, bombsAmount = 40;
			break;
		case "expert":
			var ROWS = 16, COLS = 30, bombsAmount = 99;
			break;
		default:
			return null;
	}
	var array = new Array(ROWS);
	for(var k=0; k<ROWS; k++) {
		array[k] = new Array(COLS);
		for(var i=0; i<COLS; i++) {
			array[k][i] = 0;
		}
	}
	generateBombs(array, bombsAmount, ROWS, COLS);
	return array;
}

function generateBombs(board, bombsAmount, ROWS, COLS) {
	for(var i=0; i<bombsAmount; i++) {
		do {
			var posx = Math.floor(Math.random()*ROWS);
			var posy = Math.floor(Math.random()*COLS);
		} while (board[posx][posy] == -1);
		board[posx][posy] = -1;
		for(var temp in dir) {
			if(inBounds(posx+dir[temp][0], posy+dir[temp][1], ROWS, COLS) && board[posx+dir[temp][0]][posy+dir[temp][1]] != -1)
				board[posx+dir[temp][0]][posy+dir[temp][1]]++;
		}
	}
}

function inBounds(posx, posy, ROWS, COLS) {
	if(posx >= 0 && posx < ROWS && posy >= 0 && posy < COLS)
		return true;
	return false;
}

/*
******************************
          Outras    
******************************
*/

function Game(id, group, player, level) {
	this.id = id;
	this.group = group;
	this.playerone = { name: player };
	this.playertwo = {};
	this.board = null;
	this.turn = Math.floor((Math.random() * 2) + 1);
	this.level = level;
}

function getTurn(game) {
	if(game.turn == 1) {
		return game.playerone.name;
	}
	else return game.playertwo.name;
}

function verifyJSON (json, requires) { // só verifica os requires
	for(var req in requires) {
		if(!json.hasOwnProperty(requires[req]))
			return "Parameter " + requires[req] + " absent.";
	}
	for(var js in ["group", "row", "col"])
		if(json.hasOwnProperty(js) && !(Number.isInteger(json.group) && json.group > 0 && json.group.toString().length <= 2))
			return "Invalid parameter " + js + ".";
	if(json.name)
		if(!(json.name.length > 0 && /^[a-zA-Z0-9_]*$/.test(json.name.toString())))
			return "Invalid parameter name.";
	if(json.pass)
		if(!(json.name.length > 0))
			return "Invalid parameter pass.";
	if(json.key)
		if(!(/^[0-9A-F]+$/.test(json.key.toString()) && json.key.toString().length == 32))
			return "Invalid parameter key.";
	if(json.game)
		if(!(Number.isInteger(json.game) && json.game > 0))
			return "Invalid parameter game.";
	if(json.level)
		if(!(json.level === "beginner" || json.level === "intermediate" || json.level === "expert"))
			return "Invalid parameter level.";
	return null;
}