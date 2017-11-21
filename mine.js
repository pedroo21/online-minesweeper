/*

Iúri Pena & Pedro Lourenço

*/

var dificulty = "Fácil";
var multiplayer = {};
var URL = "http://twserver.alunos.dcc.fc.up.pt:8000/";
var gameTimer, minutes, seconds;
var debug = false, firstClick = true, gameOver = false;
var ROWS = 9, COLS = 9, bombsAmount = 10;
var flagsCounter, clicksCounter = 0;
var board, flags, revealedCells = [];
var fscore = JSON.parse(localStorage.getItem("easy")) || [];
var mscore = JSON.parse(localStorage.getItem("interm")) || [];
var dscore = JSON.parse(localStorage.getItem("expert")) || [];
var dir = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

window.onload = function() {
	document.getElementById('game').addEventListener('contextmenu', function(ev) {
		ev.preventDefault();

		if (ev.target.className == 'fa fa-flag' || ev.target.className == 'fa fa-question' ||
			ev.target.className == 'fa fa-bomb')
			onContextMenu(ev.target.parentNode.parentNode.rowIndex, ev.target.parentNode.cellIndex);
		else onContextMenu(ev.target.parentNode.rowIndex, ev.target.cellIndex);
	});
	multiplayer.enabled = false;
	newGame();
	updateScores(fscore, 0);
	updateScores(mscore, 1);
	updateScores(dscore, 2);
	showGame();
}

function newGame() {
	var table = document.getElementById("game");
	var tbody = document.getElementsByTagName("tbody");
	if(tbody[0] != null) 
		table.removeChild(tbody[0]);
	var tbody = document.createElement("tbody");

	table.appendChild(tbody);

	if(dificulty == "Fácil") { 
		ROWS = 9, COLS = 9;
		bombsAmount = 10;
		adjustCanvas("5vh", "18vw", "500", "500");
		initAnimations();
	}
	else if(dificulty == "Médio") { 
		ROWS = 16, COLS = 16;
		bombsAmount = 40;
		adjustCanvas("20vh", "17vw", "650", "500");
		initAnimations();
	}
	else if(dificulty == "Difícil"){
		ROWS = 16, COLS = 30;
		bombsAmount = 99;
		adjustCanvas("20vh", "15vw", "700", "500");
		initAnimations();
	}

	for(var i=0; i<ROWS; i++) {
		var tr = document.createElement('tr');
		for(var k=0; k<COLS; k++) {
			var td = document.createElement('td');
			td.setAttribute("id", i + "," + k);
			if(!multiplayer.enabled) td.setAttribute("onclick", "onClick(" + i + "," + k + ")");
			else td.setAttribute("onclick", "notify(" + i + "," + k + ")");
			td.setAttribute("class", "col-md-1");
			td.appendChild(document.createTextNode(" "));
			tr.appendChild(td);
		}
		tbody.appendChild(tr);
	}
	board = createArray(board, ROWS, COLS);
	revealedCells = [];
	if(!multiplayer.enabled) {
		flags = createArray(flags, ROWS, COLS); 
		generateAllBombs();
		if(debug) showAllBombs(0, 0);
		showFeedback("Clica numa célula para iniciar o jogo");
	} else {
		showFeedback("Adversário encontrado");
	}
	resetCounters();
	stopAnimations();
	gameOver = false;
	firstClick = true;
}

function onClick(i, k) {
	if(!gameOver) {
		if(flags[i][k] != 0) 
			return;

		if(board[i][k] != -1) increaseClicks(i, k);
		if(board[i][k] == -1) {
			if(firstClick) {
				changeBombPosition(i, k);
				return;
			} else {
				showAllBombs(i, k);
				gameOver = true;
				clearInterval(gameTimer);
				return;
			}
		}
		else if(board[i][k] > 0) revealNumber(i, k, 0);
		else if(board[i][k] == 0)
			showEmptyNeighboors(i, k);

		if(firstClick) {
			startTimer();
			firstClick = false;
			showFeedback("Os números indicam bombas na vizinhança.");
		}
		if(revealedCells.length == ROWS * COLS - bombsAmount) {
			showFeedback("Parabéns! Ganhaste o jogo.");
			showAllFlags();
			gameOver = true;
			clearInterval(gameTimer);
			if(!debug)
				addScore(dificulty);
			playAnimations();
		}
	}
}

function onContextMenu(i, k) {
	if(multiplayer.enabled)
		return;
	if(i == undefined || k == undefined)
		return;
	if(!gameOver) { // se tiver sido descoberta
		if(revealedCells.indexOf(i + ',' + k) == -1) {
			if(flags[i][k] == 1) {
				removeFlag(i, k);
				revealQuestion(i, k);
				flags[i][k] = 2;
			}
			else if(flags[i][k] == 2) {
				clearCell(i, k);
				flags[i][k] = 0;
			}
			else {
				revealFlag(i, k);
				flags[i][k] = 1;
				if(firstClick) {
					startTimer();
					firstClick = false;
				}
			}
		}
		else if(revealedCells.indexOf(i + ',' + k) != -1) {
			checkAcorde(i, k);
		}
	}
}

function checkAcorde(i, k) {
	document.getElementById(i + "," + k).onclick = function(ev) {
		if(ev.which == 1 && board[i][k] > 0 && flagsNear(i, k) == board[i][k]) {
			makeAcorde(i, k);
		}
	};
	document.getElementById(i + "," + k).onmouseup = function(ev) {
		if(ev.which == 3) {
			document.getElementById(i + "," + k).onclick = onClick(i, k);
		}
	};
}

function makeAcorde(i, k) {
	for(var temp in dir) {
		if(inBounds(i+dir[temp][0], k+dir[temp][1]))
			onClick(i+dir[temp][0], k+dir[temp][1]);
	}
}

function flagsNear(posx, posy) {
	var count = 0;
	for(var temp in dir) {
		if(inBounds(posx+dir[temp][0], posy+dir[temp][1]) && flags[posx+dir[temp][0]][posy+dir[temp][1]] == 1)
			count++;
	}
	return count;
}

function showEmptyNeighboors(posx, posy) {
	if(board[posx][posy] == 0) {
		var list = [];
		list.push([posx, posy]);
		while(list.length != 0) {
			var pos = list.shift();
			var posx = pos[0];
			var posy = pos[1];
			if(board[posx][posy] != 0) {
				if(board[posx][posy] > 0) {
					if(flags[posx][posy] == 0) revealNumber(posx, posy, 0);
				}
			} else {
				if(flags[posx][posy] == 0) {
					for(var temp in dir) {
						if(inBounds(posx+dir[temp][0], posy+dir[temp][1]))
							list.push([posx+dir[temp][0], posy+dir[temp][1]]);
					}
					revealWhite(posx, posy);
					board[posx][posy] = -2;
				}
			}
		}
	}
}

function generateBomb() { /* Down, Up, Right, Left, Down-Right, Down-Left, Up-Right, Up-Left */
	do {
		var posx = Math.floor(Math.random()*ROWS);
		var posy = Math.floor(Math.random()*COLS);
	} while (board[posx][posy] == -1);
	board[posx][posy] = -1;
	for(var temp in dir) {
		if(inBounds(posx+dir[temp][0], posy+dir[temp][1]) && board[posx+dir[temp][0]][posy+dir[temp][1]] != -1)
			board[posx+dir[temp][0]][posy+dir[temp][1]]++;
	}
}

function generateAllBombs() {
	for(var i=0; i<bombsAmount; i++) {
		generateBomb();
	}
}

function changeBombPosition(i, k) {
	generateBomb();
	board[i][k] = 0;

	for(var temp in dir) { //Decrementar vizinança
		if(inBounds(i+dir[temp][0], k+dir[temp][1]) && board[i+dir[temp][0]][k+dir[temp][1]] != -1)
			board[i+dir[temp][0]][k+dir[temp][1]]--;
	}
	for(var temp in dir) { //Além de retirar a bomba, há que calcular o valor dessa célula
		if(inBounds(i+dir[temp][0], k+dir[temp][1]) && board[i+dir[temp][0]][k+dir[temp][1]] == -1)
			board[i][k]++;
	}
	onClick(i, k);
	if(debug) showAllBombs(0, 0);
}

function showAllBombs(x, y) {
	for(var i=0; i<ROWS; i++) {
		for(var k=0; k<COLS; k++) {
			if (board[i][k] == -1) {
				revealBomb(i, k);
			}
		}
	}
	if(!debug)
		document.getElementById(x + "," + y).style.backgroundColor = "rgba(255,0,0,0.4)";
	document.getElementById("game-sub-header").innerHTML = "Ups! Perdeste o Jogo :(";
	$('.fa-bomb').fadeOut(0); $('.fa-bomb').fadeIn(1200);
}

function showAllFlags() {
	for(var i=0; i<ROWS; i++) {
		for(var k=0; k<COLS; k++) {
			if (board[i][k] == -1) {
				revealFlag(i, k);
			}
		}
	}
}

function inBounds(posx, posy) {
	if(posx >= 0 && posx < ROWS && posy >= 0 && posy < COLS)
		return true;
	return false;
}

function increaseClicks(i, k) {
	if(revealedCells.indexOf(i + ',' + k) != -1)
		return;
	clicks.innerHTML = ++clicksCounter;
}

function revealWhite(i, k) {
	document.getElementById(i + "," + k).innerHTML = "";
	document.getElementById(i + "," + k).style.background = "lightgray";
	pushCell(i, k);
}

function showFeedback(message) {
	document.getElementById("game-sub-header").innerHTML = message;
}

function revealFlag(i, k) {
	if(flags[i][k] == 1) {
		flagsCounter++;
	}
	document.getElementById(i + "," + k).className = "opened";
	document.getElementById(i + "," + k).innerHTML = "";
	var img = document.createElement('i');
	img.setAttribute("class", "fa fa-flag");
	document.getElementById(i + "," + k).appendChild(img);
	flagsCounter--;
	updateFlags();
}

function removeFlag(i, k) {
	clearCell(i, k);
	flagsCounter++;
	updateFlags();
}

function updateFlags() {
	document.getElementById("flags").innerHTML = flagsCounter;
}

function clearCell(i, k) {
	document.getElementById(i + "," + k).className = "col-md-1";
	document.getElementById(i + "," + k).innerHTML = "";
}

function revealQuestion(i, k) {
	document.getElementById(i + "," + k).className = "opened";
	var img = document.createElement('i');
	img.setAttribute("class", "fa fa-question");
	document.getElementById(i + "," + k).appendChild(img);
}

function revealBomb(i, k) {
	var img = document.createElement('i');
	img.setAttribute("class", "fa fa-bomb");
	document.getElementById(i + "," + k).innerHTML = "";
	document.getElementById(i + "," + k).appendChild(img);
	document.getElementById(i + "," + k).style.background = "lightgray";

	if(multiplayer.enabled) {
		if(multiplayer.opponent == multiplayer.name)
			document.getElementById(i + "," + k).style.backgroundColor = "rgba(255,0,0,0.4)";
		else
			document.getElementById(i + "," + k).style.backgroundColor = "rgba(0,50,255,0.4)";
	}
}

function revealNumber(i, k, x) {
	var colors = ["blue", "blue", "green", "red", "darkblue", "brown", "cyan", "black", "gray"]
	document.getElementById(i + "," + k).style.fontWeight = "bold";
	
	if(!multiplayer.enabled) {
		if (board[i][k] <= 8)
			document.getElementById(i + "," + k).style.color = colors[board[i][k]];
		else
			document.getElementById(i + "," + k).style.color = colors[0];
	
		document.getElementById(i + "," + k).innerHTML = board[i][k];
	}
	else {
		document.getElementById(i + "," + k).style.color = colors[x];
		document.getElementById(i + "," + k).innerHTML = x;
	}

	document.getElementById(i + "," + k).style.background = "lightgray";
	pushCell(i, k);
}

function showGame() {
	document.getElementById("dificulty").addEventListener("change", optionChange);
	document.getElementById("bombsAmount").addEventListener("keyup", realTimeValidation);
	document.getElementById("linesAmount").addEventListener("keyup", realTimeValidation);
	document.getElementById("columnsAmount").addEventListener("keyup", realTimeValidation);
	document.getElementById("login-container").style.display = "none";
	$('#sidebar-multi').fadeOut(0); $('#sidebar-single').fadeOut(0);
	$('#sidebar-single').fadeIn(1200);
	document.getElementById("sidebar-single").style.visibility = "visible";
	document.getElementById("sidebar-multi").style.visibility = "hidden";
	document.getElementById("high-scores-multi").style.display = "none";
	document.getElementById("high-scores").style.display = "inline";
	document.body.style.background = "none";
	document.getElementById("topmenu-login").className = "";
	document.getElementById("topmenu-jogar").className = "active";
	document.getElementById("container").style.visibility = "visible";
	document.getElementById("game-container").style.visibility = "visible";
	document.getElementById("logged-in").style.display = "inline";
	document.getElementById("logged-username").innerHTML = document.getElementById("username").value;
	document.getElementById("not-logged").style.display = "none";
	document.getElementById("searching-players").innerHTML = "";
	multiplayer.enabled = false;
	newGame();
	$('#game-container').fadeIn(0);
	$('#game').fadeOut(0); $('#game').fadeIn(1200);
	initAnimations(); /* Faz parte do explosion */
}

function hideGame() {
	$('#sidebar-multi').fadeOut(0); $('#sidebar-single').fadeOut(0);
	$('#game-container').fadeOut(0);
	document.getElementById("login-container").style.display = "";
	document.getElementById("sidebar-multi").style.visibility = "hidden";
	document.getElementById("sidebar-single").style.visibility = "hidden";
	document.body.style.background = "url(./img/background.jpg)";
	document.getElementById("topmenu-login").className = "active";
	document.getElementById("topmenu-jogar").className = "";
	document.getElementById("container").style.visibility = "hidden";
	document.getElementById("game-container").style.visibility = "hidden";
	document.getElementById("logged-in").style.display = "none";
	document.getElementById("not-logged").style.display = "inline";
}

/* Segunda Etapa */

function checkLogin() {
	var data = {};
	data.name = document.getElementById("username").value;
	data.pass = document.getElementById("password").value;

	if(data.name === "") {
		loginAlert("O usuário não pode estar vazio.", true);
		return;
	}
	re = /^\w+$/;
	if(!re.test(data.name)) {
		loginAlert("O usuário só pode conter letras, números ou underscores.", true);
		return;
	}
	if(!checkPassword(document.getElementById("password").value)) {
		loginAlert("A password deve conter pelo menos 6 caracteres e uma letra maiúscula/minúscula/número.", true);

		return;
	}

	loadButton(document.getElementById("Login"));
	//makeXMLRequestAsync("register", data, CBLogin);
	setTimeout(function() {
		stopLoadButton(document.getElementById("Login"));
		showGame();
	}, 500);
}

function checkRegister() {
	var data = {};
	data.name = document.getElementById("username-register").value;
	data.pass = document.getElementById("password-register").value;

	if(data.name == "") {
		loginAlert("O usuário não pode estar vazio.", true);
		return;
	}
	re = /^\w+$/;
	if(!re.test(data.name)) {
		loginAlert("O usuário só pode conter letras, números ou underscores.", true);
		return;
	}
	if(!checkPassword(document.getElementById("password-register").value)) {
		loginAlert("A password deve conter pelo menos 6 caracteres e uma letra maiúscula/minúscula/número.", true);
		return;
	}
	if(document.getElementById("password-register").value != document.getElementById("cpassword-register").value) {
		loginAlert("As passwords não conferem.", true);
		return;
	}
	loadButton(document.getElementById("Register"));
	makeXMLRequestAsync("register", data, CBRegister);
}

function loginAlert(string, error) {
	var box = document.getElementById("login-alerts");

	box.innerHTML = "";
	box.className = "";
	if(string != "") {
		if(error) {
			box.innerHTML = "<strong>Erro!</strong> " + string;
			box.className = "alert alert-danger";
		}
		else {
			box.innerHTML = string;
			box.className = "alert alert-success";
		}
	}
}

function findGame() {
	if(multiplayer.isplaying)
		modalAlert("Não é possível saír a meio de um jogo.");
	else if (multiplayer.iswaiting) 
		return;
	else {
		var data = {};
		data.name = document.getElementById("username").value;
		data.pass = document.getElementById("password").value;

		if(document.getElementById("multidificulty").value == "Fácil") {
			dificulty = "Fácil";
			data.level = "beginner";
		}
		else if (document.getElementById("multidificulty").value == "Médio") {
			dificulty = "Médio";
			data.level = "intermediate";
		}
		else {
			dificulty = "Difícil";
			data.level = "expert";
		}

		data.group = 30;

		$('#game').fadeOut(0); $('#game').fadeIn(1200);
		$('#menu-alerts').html("");
		multiplayer.iswaiting = true;
		waitforGame();
		stopAnimations();
		makeXMLRequestAsync("join", data, CBJoin);
	}
}

function cancelFind() {
	if(multiplayer.isplaying)
		modalAlert("Não é possível saír a meio de um jogo.");
	else if (!multiplayer.iswaiting)
		return;
	else {
		multiplayerDefault();
		leaveGame();
	}
}

function leaveGame() {
	var data = {};
	data.name = document.getElementById("username").value;
	data.key = multiplayer.key;
	data.game = multiplayer.game;

	gameOver = true;
	multiplayer.isplaying = false;
	multiplayer.iswaiting = false;

	clearInterval(gameTimer);

	makeXMLRequestAsync("leave", data, CBLeave);
}

function waitforGame() {
	var table = document.getElementById("game");
	var tbody = document.getElementsByTagName("tbody");
	if(tbody[0] != null) 
		table.removeChild(tbody[0]);
	showFeedback("O jogo irá iniciar assim que um adversário for encontrado");
	document.getElementById("searching-players").innerHTML = '<i class="fa fa-circle-o-notch fa-spin fa-3x"></i>';
	document.getElementById("title-players-sidebar").innerHTML = "Nenhum Adversário ";
	document.getElementById("searching-players-sidebar").innerHTML = '<i class="fa fa-circle-o-notch fa-spin fa-2x"></i>';
	document.getElementById("bomb-stats-sidebar").style.display = "none";

	if(dificulty == "Fácil")
		document.getElementById("bombs-total").innerHTML = 9;
	else if(dificulty == "Médio")
		document.getElementById("bombs-total").innerHTML = 39;
	else
		document.getElementById("bombs-total").innerHTML = 99;
}

function multiplayerDefault() {
	var table = document.getElementById("game");
	var tbody = document.getElementsByTagName("tbody");
	if(tbody[0] != null) 
		table.removeChild(tbody[0]);
	showFeedback("Escolhe as tuas definições no painel lateral esquerdo");
	document.getElementById("searching-players").innerHTML = '<i class="fa fa-gear fa-3x"></i>';
	document.getElementById("title-players-sidebar").innerHTML = "Nenhum Adversário ";
	document.getElementById("searching-players-sidebar").innerHTML = "";
	document.getElementById("bomb-stats-sidebar").style.display = "none";
	document.getElementById("minutes-multi").innerHTML = "00";
	document.getElementById("seconds-multi").innerHTML = "00";
	document.getElementById("bombs-total").innerHTML = "0";
}

function notify(i,k) { // nova jogada			
	if(gameOver)
		return;
	if(document.getElementById("username").value != multiplayer.turn) { // verificar vez
		showFeedback("Espera pela tua vez");
	} else {
		var data = {};
		data.name = document.getElementById("username").value;
		data.game = multiplayer.gamenum;
		data.key = multiplayer.key;
		data.row = i+1;
		data.col = k+1;
		makeXMLRequestAsync("notify", data, CBNotify);
	}
}

function getScore() {
	var data = {};
	data.name = document.getElementById("username").value;

	data.level = "beginner";
	makeXMLRequestAsync("score", data, CBScoreF);

	data.level = "intermediate";
	makeXMLRequestAsync("score", data, CBScoreM);

	data.level = "expert";
	makeXMLRequestAsync("score", data, CBScoreD);
}

function getRankings() {
	var data = {};
	
	data.level = "beginner";
	makeXMLRequestAsync("ranking", data, CBRankingF);

	data.level = "intermediate";
	makeXMLRequestAsync("ranking", data, CBRankingM);

	data.level = "expert";
	makeXMLRequestAsync("ranking", data, CBRankingD);
}

function logout() {
	if(multiplayer.isplaying || multiplayer.iswaiting)
		modalAlert("Não é possível saír a meio de um jogo.");
	else
		hideGame();
		stopAnimations();
		return;
}

/* Call Backs - Due to Async Calls */

function CBRankingF(response) {
	multiplayer.franking = JSON.parse(response).ranking;

	var x = "FM";
	for(var i=0; i<11; i++)
		if(multiplayer.franking[i])
			document.getElementById(x+i).innerHTML = multiplayer.franking[i].name + " - " + multiplayer.franking[i].score;
}

function CBRankingM(response) {
	multiplayer.mranking = JSON.parse(response).ranking;

	var x = "MM";
	for(var i=0; i<11; i++)
		if(multiplayer.mranking[i])
			document.getElementById(x+i).innerHTML = multiplayer.mranking[i].name + " - " + multiplayer.mranking[i].score;
}

function CBRankingD(response) {
	multiplayer.dranking = JSON.parse(response).ranking;

	var x = "DM";
	for(var i=0; i<11; i++)
		if(multiplayer.dranking[i])
			document.getElementById(x+i).innerHTML = multiplayer.dranking[i].name + " - " + multiplayer.dranking[i].score;
}

function CBScoreF(response) {
	multiplayer.score = JSON.parse(response);

	document.getElementById("fscore").innerHTML = "Fácil: " + multiplayer.score.score;
}

function CBScoreM(response) {
	multiplayer.score = JSON.parse(response);

	document.getElementById("mscore").innerHTML = "Médio: " + multiplayer.score.score;
}

function CBScoreD(response) {
	multiplayer.score = JSON.parse(response);

	document.getElementById("dscore").innerHTML = "Díficil: " + multiplayer.score.score;
}

function CBLeave(response) {
	multiplayer.iswaiting = false;
	multiplayer.isplaying = false;
	gameOver = true;
	firstClick = true;
}

function CBJoin(response) {
	var joinResponse = JSON.parse(response)
	firstClick = true;

	console.log(joinResponse);

	if(joinResponse.error) {
		modalAlert(joinResponse.error);
		cancelFind();
		return;
	}

	multiplayer.gamenum = joinResponse.game;
	multiplayer.key = joinResponse.key;

	gameOver = false;

	var source = new EventSource(URL + "update?name=" + document.getElementById("username").value + 
		"&game=" + multiplayer.gamenum + "&key=" + multiplayer.key);

	source.onmessage = function (event) {
		var sourceResponse = JSON.parse(event.data);

		console.log(sourceResponse);

		if(sourceResponse.error)
			showFeedback(sourceResponse.error);
		else {
			if(firstClick) {
				multiplayer.iswaiting = false;
				multiplayer.isplaying = true;
				multiplayer.bombsPlayer = 0; multiplayer.bombsOpponent = 0;
				multiplayer.turn = sourceResponse.turn;
				multiplayer.opponent = sourceResponse.opponent;

				document.getElementById("title-players-sidebar").innerHTML = document.getElementById("username").value + 
				" vs " + multiplayer.opponent;
				document.getElementById("searching-players").innerHTML = "";
				document.getElementById("searching-players-sidebar").innerHTML = "";
				document.getElementById("bomb-stats-sidebar").style.display = '';

				newGame();
				startTimer();
				firstClick = false;
			} else {
				var uncover = sourceResponse.move.cells;
				multiplayer.turn = sourceResponse.turn;
				multiplayer.name = sourceResponse.move.name;

				for(var j = 0; j < uncover.length; j++) {
					if(uncover[j][2] == -1) {
						bombsAmount--;
						if(sourceResponse.move.name == multiplayer.opponent)
							multiplayer.bombsOpponent++;
						else multiplayer.bombsPlayer++;
						
						revealBomb(uncover[j][0]-1, uncover[j][1]-1);
						if(sourceResponse.winner) {
							showFeedback(sourceResponse.winner + " venceu o jogo!");
							playAnimations();
							leaveGame();
							getScore();
							source.close();
						}
					}
					else if(uncover[j][2] == 0) {
						revealWhite(uncover[j][0]-1, uncover[j][1]-1);
					}
					else {
						revealNumber(uncover[j][0]-1, uncover[j][1]-1, uncover[j][2]);
					}
				}

			}
			updateSideBarStats();
			updateTurn();
		}
	}
}

function CBNotify(response) { // Verificar Jogada
	if(JSON.parse(response).error)
		showFeedback(JSON.parse(response).error);
	else return;
}

function CBLogin(response) {
	stopLoadButton(document.getElementById("Login"));
	if(JSON.parse(response).error) {
		loginAlert(JSON.parse(response).error, true);
		return;
	} else {
		loginAlert("", false);
		showGame();
	}
}

function CBRegister(response) {
	stopLoadButton(document.getElementById("Register"));
	if(JSON.parse(response)['error'])
		loginAlert(JSON.parse(response)['error'], true);
	else
		loginAlert("Registado com Sucesso.", false);
}


function loadButton(element) {
	element.innerHTML = '<i class="fa fa-spinner fa-spin"> </i>' + element.innerHTML;
	element.disabled = true;
	element.classList.add("loading");
}

function stopLoadButton(element)  {
	element.getElementsByClassName("fa fa-spinner fa-spin")[0].remove();
	element.disabled = false;
	element.classList.remove("loading");
}

/* Generic Functions */

function makeXMLRequestAsync(sub, JSONData, callBack) {
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", URL + sub, true);
    xmlhttp.setRequestHeader("Content-type", "application/json");
	xmlhttp.onload = function() {
		if(xmlhttp.status != 200)
			return;
		if(xmlhttp.readyState != 4)
			return;
		callBack(xmlhttp.responseText);
	}
	xmlhttp.send(JSON.stringify(JSONData));
}

function createArray(array, rows, cols) {
	array = new Array(rows);
	for(var k=0; k<rows; k++) {
		array[k] = new Array(cols);
		for(var i=0; i<cols; i++) {
			array[k][i] = 0;
		}
	}
	return array;
}

function pushCell(i, k) {
	if(revealedCells.indexOf(i + ',' + k) == -1)
		revealedCells.push(i + ',' + k);
}

function addScore() {
	var name = document.getElementById("username").value;
	var time = minutes + ":" + seconds;

	if(dificulty == "Fácil") { 
		fscore.push({name:name, time:time});
		compareScore(fscore);
		localStorage.setItem("easy", JSON.stringify(fscore));
		updateScores(fscore, 0);
	}
	else if(dificulty == "Médio") {
		mscore.push({name:name, time:time});
		compareScore(mscore);
		localStorage.setItem("interm", JSON.stringify(mscore));
		updateScores(mscore, 1);
	}
	else if(dificulty == "Difícil"){
		dscore.push({name:name, time:time});
		compareScore(dscore);
		localStorage.setItem("expert", JSON.stringify(dscore));
		updateScores(dscore, 2);
	}
}

function compareScore (score) {
	score.sort(function(a,b) {
		return a.time>b.time ? 1 : a.time<b.time ? -1 : 0;
	});
}

function updateScores(score, dificulty) {
	var array = ["F", "M", "D"];

	for(var i=0; i<10; i++) {
		if(score[i]) {
			document.getElementById(array[dificulty] + i).innerHTML = score[i].name + " - " + score[i].time;
		}
	}
	if(score[11])
		score.splice(11,1);
}

function resetCounters() {
	clearTimeout(gameTimer);
	clicksCounter = 0; flagsCounter = bombsAmount;
	document.getElementById("minutes").innerHTML = "00";
	document.getElementById("seconds").innerHTML = "00";
	document.getElementById("clicks").innerHTML = 0;
	document.getElementById("flags").innerHTML = flagsCounter;
}

function startTimer() {
	minutes = 0;
	seconds = 0;
	var total = 0;
	gameTimer = setInterval(setTime,1000);

	function setTime () {
		++total;
        minutes = pad(parseInt(total / 60));
        seconds = pad(total % 60);
		
		if(!multiplayer.enabled) {
			document.getElementById("minutes").innerHTML = minutes;
			document.getElementById("seconds").innerHTML = seconds;
		}
		else {
			document.getElementById("minutes-multi").innerHTML = minutes;
			document.getElementById("seconds-multi").innerHTML = seconds;	
		}
   }
    
    function pad (val) {
    	var valStr = val + "";
    	if (valStr.length < 2) return "0" + valStr;
    	else
    		return valStr;
    }
}

function checkPassword(str) {
    var re = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
   	return re.test(str);
}

/* Visual Improvemenets, Side Bar Toggle, Validation */

function adjustCanvas(top, right, width, height) {
	document.getElementById("effects-game").style.top = top;
	document.getElementById("effects-game").style.right = right;
	document.getElementById("effects-game").setAttribute("width", width);
	document.getElementById("effects-game").setAttribute("height", height);
}

function playAnimations() {
	update();
	var canvas = document.getElementById("effects-game");
	canvas.style.zIndex = 11;

	for(var i=0; i<10; i++) {
		setTimeout(function() { 
			makeStars(Math.floor((Math.random() * canvas.width-50) + 50), Math.floor((Math.random() * canvas.height-50) + 50)); 
		}, 1000+i*500);
	}
	setTimeout(stopAnimations, 6500);
}

function onSubmit(e) {
	dificulty = document.getElementById("dificulty").value;
	if(dificulty == "Custom" && document.getElementById("menu").getElementsByClassName("has-error").length != 0) {
		menuError();
		return;
	}
	ROWS = document.getElementById("linesAmount").value;
	COLS = document.getElementById("columnsAmount").value;
	bombsAmount = document.getElementById("bombsAmount").value;
	if(ROWS && COLS && bombsAmount && ROWS*COLS <= bombsAmount) {
		menuError();
		return;
	}
	debug = document.getElementById("debugMode").checked;
	$('#game').fadeOut(0); $('#game').fadeIn(1200);
	$('#menu-alerts').html("");
	newGame();
}


function changeMenu(element) { // trocar menus single player vs multiplayer
	stopAnimations();
	if(element.getAttribute("id") == "multiplayer") {
		$('#sidebar-single').fadeOut(0); $('#sidebar-multi').fadeIn(1200);
		document.getElementById("sidebar-multi").style.visibility = "visible";
		document.getElementById("sidebar-single").style.visibility = "hidden";
		document.getElementById("high-scores").style.display = "none";
		document.getElementById("high-scores-multi").style.display = "inline";
		multiplayer.enabled = true;
		multiplayerDefault();
		getScore();
	}
	else {
		if(multiplayer.iswaiting || multiplayer.isplaying) {
			modalAlert("Deves cancelar o jogo ou pesquisa antes de trocar de modo.");
			return;
		}
		$('#sidebar-multi').fadeOut(0); $('#sidebar-single').fadeIn(1200);
		document.getElementById("sidebar-single").style.visibility = "visible";
		document.getElementById("sidebar-multi").style.visibility = "hidden";
		document.getElementById("searching-players").innerHTML = "";
		document.getElementById("high-scores").style.display = "inline";
		document.getElementById("high-scores-multi").style.display = "none";
		multiplayer.enabled = false;
		newGame();
	}
}

function updateSideBarStats() {
	document.getElementById("bombs-player").innerHTML = multiplayer.bombsPlayer;
	document.getElementById("bombs-opponent").innerHTML = multiplayer.bombsOpponent;
	if(dificulty != "Difícil")
		document.getElementById("bombs-total").innerHTML = bombsAmount-1;
	else
		document.getElementById("bombs-total").innerHTML = bombsAmount;
}

function updateTurn() {
	document.getElementById("title-players-sidebar").innerHTML = 
	document.getElementById("title-players-sidebar").innerHTML
	.replace("<b>", "").replace("</b>", "") /* Retirar antigo turno */
	.replace(multiplayer.turn, "<b>" + multiplayer.turn + "</b>"); /* Colocar novo turno */
	if(!gameOver) {	
		if(multiplayer.turn == multiplayer.opponent) 
			showFeedback("O oponente está a jogar")
		else showFeedback("É a tua vez de jogar");
	}
}

function showLogin(element) {
	$("#login-form").delay(100).fadeIn(100);
 	$("#register-form").fadeOut(100);
	$('#register-form-link').removeClass('active');
	$(element).addClass('active');
}

function showRegister(element) {
	$("#register-form").delay(100).fadeIn(100);
 	$("#login-form").fadeOut(100);
	$('#login-form-link').removeClass('active');
	$(element).addClass('active');
}

function menuError() {
	$('#menu-alerts').html('<div class="alert alert-warning fade in"><a href="#" class="close" data-dismiss="alert">&times;</a></a><strong>Erro!</strong> Foram introduzidos dados inválidos.</div>');
}

function modalAlert(message) {
	document.getElementById("game-alerts-message").innerHTML = message;
	$('#game-alerts-modal').modal('toggle');
}

function optionChange(e) {
	if(this.value == "Custom") {
		document.getElementById("bombsAmount").removeAttribute("disabled");
		document.getElementById("linesAmount").removeAttribute("disabled");
		document.getElementById("columnsAmount").removeAttribute("disabled");
	} else {
		document.getElementById("bombsAmount").setAttribute("disabled", "disabled");
		document.getElementById("linesAmount").setAttribute("disabled", "disabled");
		document.getElementById("columnsAmount").setAttribute("disabled", "disabled");
	}
}

function realTimeValidation() { //ver se é número e está nos limites

	if(!isNaN($(this).val()) && +$(this).val() <= +$(this).attr("max") && +$(this).val() >=
		+$(this).attr("min")) {
    	$(this).parent().removeClass("has-error");
    	$(this).parent().addClass("has-success");
    }
    else {
    	$(this).parent().removeClass("has-sucess");
    	$(this).parent().addClass("has-error");
    }
}

$(document).ready(function () {
  $('[data-toggle=offcanvas]').click(function () {
    if ($('.sidebar-offcanvas').css('background-color') == 'rgb(255, 255, 255)') {
	    $('.list-group-item').attr('tabindex', '-1');
    } else {
	    $('.list-group-item').attr('tabindex', '');
    }
    $('.row-offcanvas').toggleClass('active'); // Esta classe faz a transação smooth (ver CSS)
    
  });
});