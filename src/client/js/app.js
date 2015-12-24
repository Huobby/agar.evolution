var io = require('socket.io-client');

var playerName;
var playerType;
var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;
var KEY_ENTER = 13;
var KEY_FIREFOOD = 119;
var KEY_SPLIT = 32;
var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;
var borderDraw = false;
var animLoopHandle;
var spin = -Math.PI;
var enemySpin = -Math.PI;
var mobile = false;
var needBot = true;
var botStarted = false;
var bot;

/*  
 * === PARAMETERS ======================================================================   
 * Author: Firebb
 * Description:  game settings
 * ===================================================================================== 
 */
var splitDistance = 625;

var debug = function(args) {
    if (console && console.log) {
	console.log(args);
    }
};

if ( /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) ) {
    mobile = true;
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: startGame  
 * Author: Firebb
 * Description:  game entry
 * ===================================================================================== 
 */ 
function startGame(type) {
    playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0,25);
    playerType = type;

    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;

    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    if (!socket) {
	socket = io({query:"type=" + type});
	setupSocket(socket);
    }
    if (!animLoopHandle)
	animloop();
    socket.emit('respawn');
    if (needBot && !botStarted) {
	bot = new smartBot();
	botStarted = true;
    }
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: validNick 
 * Author: Firebb
 * Description: check if nick is valid alphanumeric characters (and underscores)
 * ===================================================================================== 
 */ 
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: window onload 
 * Author: Firebb
 * Description: add event to the welcome page button
 * ===================================================================================== 
 */ 
window.onload = function() {

    var btn = document.getElementById('startButton'),
	btnS = document.getElementById('spectateButton'),
	nickErrorText = document.querySelector('#startMenu .input-error');

    btnS.onclick = function () {
	startGame('spectate');
    };
    btn.onclick = function () {

	// check if the nick is valid
	if (validNick()) {
	    nickErrorText.style.opacity = 0;
	    startGame('player');
	} else {
	    nickErrorText.style.opacity = 1;
	}
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');
    var instructions = document.getElementById('instructions');

    // show the setting Menu
    settingsMenu.onclick = function () {
	if (settings.style.maxHeight == '300px') {
	    settings.style.maxHeight = '0px';
	} else {
	    settings.style.maxHeight = '300px';
	}
    };

    // input player name
    playerNameInput.addEventListener('keypress', function (e) {
	    var key = e.which || e.keyCode;

	    if (key === KEY_ENTER) {
	    if (validNick()) {
	    nickErrorText.style.opacity = 0;
	    startGame('player');
	    } else {
	    nickErrorText.style.opacity = 1;
	    }
	    }
	    });
};

// Canvas parameters
var screenWidth = window.innerWidth;		    // relate to client view
var screenHeight = window.innerHeight;
var gameWidth = 0;
var gameHeight = 0;
var xoffset = -gameWidth;
var yoffset = -gameHeight;

var gameStart = false;
var disconnected = false;
var died = false;
var kicked = false;

// defaults
// TODO break out into GameControls
var continuity = false;
var startPingTime = 0;
var toggleMassState = 0;
var backgroundColor = '#f2fbff';
var lineColor = '#000000';

// 
var foodConfig = {
border: 0,          
};

//
var playerConfig = {
border: 6,
	textColor: '#FFFFFF',
	textBorder: '#000000',
	textBorderSize: 3,
	defaultSize: 30
};

// player info
var player = {
id: -1,                                               // player id
    x: screenWidth / 2,                                   // player always in the center of the screen
    y: screenHeight / 2,
    screenWidth: screenWidth,
    screenHeight: screenHeight,
    target: {x: screenWidth / 2, y: screenHeight / 2}
};
//foods 是一个数组，储存周围可以吃的小球 ， fireFood是发射出去的小球 ，users附近的玩家，leaderboard是右上角的计分板
//target当前玩家下一步运动的方向，

var foods = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = {x: player.x, y: player.y};
var reenviar = true;
var directionLock = false;
var directions = [];

/*  
 * === FUNCTION ====================================================================== 
 * Name: canvas events 
 * Author: Firebb
 * Description: add event to the canvas
 * c for canvas
 * ===================================================================================== 
 */ 
var c = document.getElementById('cvs');
c.width = screenWidth; c.height = screenHeight;
c.addEventListener('mousemove', gameInput, false);
c.addEventListener('mouseout', outOfBounds, false);
c.addEventListener('keypress', keyInput, false);
c.addEventListener('keyup', function(event) {reenviar = true; directionUp(event);}, false);
c.addEventListener('keydown', directionDown, false);
c.addEventListener('touchstart', touchInput, false);
c.addEventListener('touchmove', touchInput, false);

/*  
 * === FUNCTION ====================================================================== 
 * Name: window onload 
 * Author: Firebb
 * Description: register when the mouse goes off the canvas
 * ===================================================================================== 
 */ 
function outOfBounds() {
    if (!continuity) {			// mouse out of canvas, if set continuity in settings keep moving otherwise stop
	target = { x : 0, y: 0 };
    }
}

// visibility of the border
var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = toggleBorder;

// show message 
var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = toggleMass;

// continuity for mouse out of canvas
var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = toggleContinuity;

// canvas 2d painter, graph used for further painting
var graph = c.getContext('2d');

/*  
 * === FUNCTION ====================================================================== 
 * Name: ChatClient 
 * Author: Firebb
 * Description: bind component
 * ===================================================================================== 
 */ 
function ChatClient(config) {
    this.commands = {};
    var input = document.getElementById('chatInput');
    input.addEventListener('keypress', this.sendChat.bind(this));
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: generate dom object for the message
 * Author: Firebb
 * Description: template into chat box a new message from a player 
 * args(sender's name, sendmessage, if it is me)
 * ===================================================================================== 
 */ 
ChatClient.prototype.addChatLine = function (name, message, me) {
    if (mobile) {
	return;
    }
    var newline = document.createElement('li');

    // color the chat input appropriately
    newline.className = (me) ? 'me' : 'friend';
    newline.innerHTML = '<b>' + ((name.length < 1) ? 'A cell unnamed' : name) + '</b>: ' + message;

    this.appendMessage(newline);
};


/*  
 * === FUNCTION ====================================================================== 
 * Name: create dom object for system message 
 * Author: Firebb
 * Description:  template into chat box a new message from the application 
 * args(system message)
 * ===================================================================================== 
 */ 
ChatClient.prototype.addSystemLine = function (message) {
    if (mobile) {
	return;
    }
    var newline = document.createElement('li');

    // message will appear in system color
    newline.className = 'system';
    newline.innerHTML = message;

    // place in message log
    this.appendMessage(newline);
};

/*  
 * === FUNCTION ====================================================================== 
 * Name: append the dom object after call addChatLine 
 * Author: Firebb
 * Description:  templates the message DOM node into the messsage area
 * args(node)
 * ===================================================================================== 
 */ 
ChatClient.prototype.appendMessage = function (node) {
    if (mobile) {
	return;
    }
    var chatList = document.getElementById('chatList');
    if (chatList.childNodes.length > 10) {
	chatList.removeChild(chatList.childNodes[0]);
    }
    chatList.appendChild(node);
};

/*  
 * === FUNCTION ====================================================================== 
 * Name: append the dom object after call addChatLine 
 * Author: Firebb
 * Description:  sends a message or executes a command on the ENTER key 
 * ===================================================================================== 
 */ 
ChatClient.prototype.sendChat = function (key) {
    var commands = this.commands,
	input = document.getElementById('chatInput');

    key = key.which || key.keyCode;

    if (key === KEY_ENTER) {
	var text = input.value.replace(/(<([^>]+)>)/ig,'');
	if (text !== '') {

	    // this is a chat command
	    if (text.indexOf('-') === 0) {
		var args = text.substring(1).split(' ');
		if (commands[args[0]]) {
		    commands[args[0]].callback(args.slice(1));
		} else {
		    this.addSystemLine('Unrecoginised Command: ' + text + ', type -help for more info');
		}

		// just a regular message - send along to server
	    } else {
		socket.emit('playerChat', { sender: player.name, message: text });
		this.addChatLine(player.name, text, true);
	    }

	    // reset input
	    input.value = '';
	}
    }
};

/*  
 * === FUNCTION ====================================================================== 
 * Name: resgister command
 * Author: Firebb
 * Description:  add a new chat command
 * ===================================================================================== 
 */ 
ChatClient.prototype.registerCommand = function (name, description, callback) {
    this.commands[name] = {
description: description,
	     callback: callback
    };
};

/*  
 * === FUNCTION ====================================================================== 
 * Name: print help
 * Author: Firebb
 * Description:  print help of all chat commands available 
 * ===================================================================================== 
 */ 
ChatClient.prototype.printHelp = function () {
    var commands = this.commands;
    for (var cmd in commands) {
	if (commands.hasOwnProperty(cmd)) {
	    this.addSystemLine('-' + cmd + ': ' + commands[cmd].description);
	}
    }
};

var chat = new ChatClient();

/*  
 * === FUNCTION ====================================================================== 
 * Name: print help
 * Author: Firebb
 * Description:  chat command callback functions
 * ===================================================================================== 
 */ 
function keyInput(event) {
    var key = event.which || event.keyCode;
    if(key === KEY_FIREFOOD && reenviar) {
	socket.emit('1');
	reenviar = false;
    }
    else if(key === KEY_SPLIT && reenviar) {
	socket.emit('2');
	reenviar = false;
    }
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: directionDown
 * Author: cxy
 * Description: Function called when a key is pressed, will change direction if arrow key
 * ===================================================================================== 
 */ 
function directionDown(event) {
    var key = event.which || event.keyCode;

    if (directional(key)) {
	directionLock = true;
	if (newDirection(key,directions, true)) {
	    updateTarget(directions);
	    socket.emit('0', target);
	}
    }
}
/*  
 * === FUNCTION ====================================================================== 
 * Name: directionUp
 * Author: cxy
 * Description: Function called when a key is lifted, will change direction if arrow key
 * ===================================================================================== 
 */ 
function directionUp(event) {
    var key = event.which || event.keyCode;
    if (directional(key)) {
	if (newDirection(key,directions, false)) {
	    updateTarget(directions);
	    if (directions.length === 0) directionLock = false;
	    socket.emit('0', target);
	}
    }
}
/*  
 * === FUNCTION ====================================================================== 
 * Name: newDirection
 * Author: cxy
 * Description: Updates the direciton array including information about the new direction
 * ===================================================================================== 
 */ 
function newDirection(direction, list, isAddition) {
    var result = false;
    var found = false;
    for (var i = 0, len = list.length; i < len; i++) {
	if (list[i] == direction) {
	    found = true;
	    if (!isAddition) {
		result = true;
		//remove the direction
		list.splice(i, 1);
	    }
	    break;
	}
    }
    //add the direction
    if (isAddition && found === false) {
	result = true;
	list.push(direction);
    }

    return result;
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: updateTarget
 * Author: cxy
 * Description: Updates the target according to the directions in the directions array
 * ===================================================================================== 
 */ 


//target就是玩家控制的小球的位置，updateTarget 就是根据direction array里面储存的运动方向改变小球的位置

function updateTarget(list) {
    target = { x : 0, y: 0 };
    var directionHorizontal = 0;
    var directionVertical = 0;
    for (var i = 0, len = list.length; i < len; i++) {
	if (directionHorizontal === 0) {
	    if (list[i] == KEY_LEFT) directionHorizontal -= Number.MAX_VALUE;
	    else if (list[i] == KEY_RIGHT) directionHorizontal += Number.MAX_VALUE;
	}
	if (directionVertical === 0) {
	    if (list[i] == KEY_UP) directionVertical -= Number.MAX_VALUE;
	    else if (list[i] == KEY_DOWN) directionVertical += Number.MAX_VALUE;
	}
    }
    target.x += directionHorizontal;
    target.y += directionVertical;
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: updateTarget
 * Author: cxy
 * Description: Different directions
 * ===================================================================================== 
 */ 

function directional(key) {
    return horizontal(key) || vertical(key);
}

function horizontal(key) {
    return key == KEY_LEFT || key == KEY_RIGHT;
}

function vertical(key) {
    return key == KEY_DOWN || key == KEY_UP;
}
function checkLatency() {
    // Ping
    startPingTime = Date.now();
    socket.emit('ping');
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: toggle ***
 * Author: cxy
 * Description: toggle different modes
 * ===================================================================================== 
 */ 
function toggleDarkMode() {
    var LIGHT = '#f2fbff',
	DARK = '#181818';
    var LINELIGHT = '#000000',
	LINEDARK = '#ffffff';

    if (backgroundColor === LIGHT) {
	backgroundColor = DARK;
	lineColor = LINEDARK;
	chat.addSystemLine('Dark mode enabled');
    } else {
	backgroundColor = LIGHT;
	lineColor = LINELIGHT;
	chat.addSystemLine('Dark mode disabled');
    }
}

function toggleBorder(args) {
    if (!borderDraw) {
	borderDraw = true;
	chat.addSystemLine('Showing border');
    } else {
	borderDraw = false;
	chat.addSystemLine('Hiding border');
    }
}

function toggleMass(args) {
    if (toggleMassState === 0) {
	toggleMassState = 1;
	chat.addSystemLine('Mass mode activated!');
    } else {
	toggleMassState = 0;
	chat.addSystemLine('Mass mode deactivated!');
    }
}

function toggleContinuity(args) {
    if (!continuity) {
	continuity = true;
	chat.addSystemLine('Continuity activated!');
    } else {
	continuity = false;
	chat.addSystemLine('Continuity deactivated!');
    }
}

/*  
 * === FUNCTION ====================================================================== 
 * Author : Wang Ziyuan
 * Description: Break out many of these game controls into a separate class 
 * Description: ping,dark and so on, some commands that we can use in the chat box
 * ===================================================================================== 
 */ 
chat.registerCommand('ping', 'Check your latency', function () {
	checkLatency();
	});

chat.registerCommand('dark', 'Toggle dark mode', function () {
	toggleDarkMode();
	});

chat.registerCommand('border', 'Toggle border', function () {
	toggleBorder();
	});

chat.registerCommand('mass', 'View mass', function () {
	toggleMass();
	});

chat.registerCommand('continuity', 'Toggle continuity', function () {
	toggleContinuity();
	});

chat.registerCommand('help', 'Chat commands information', function () {
	chat.printHelp();
	});

chat.registerCommand('login', 'Login as an admin', function (args) {
	socket.emit('pass', args);
	});

chat.registerCommand('kick', 'Kick a player', function (args) {
	socket.emit('kick', args);
	});


/*  
 * === FUNCTION ====================================================================== 
 * Name: setupSocket
 * Author: Wang Ziyuan
 * Description: Socket Stuff Handling
 * ===================================================================================== 
 */ 
function setupSocket(socket) {
    // Handle ping
    socket.on('pong', function () {
	    var latency = Date.now() - startPingTime;
	    debug('Latency: ' + latency + 'ms');
	    chat.addSystemLine('Ping: ' + latency + 'ms');
	    });

    // Handle error
    socket.on('connect_failed', function () {
	    socket.close();
	    disconnected = true;
	    });

    socket.on('disconnect', function () {
	    socket.close();
	    disconnected = true;
	    });

    // Handle connection
    socket.on('welcome', function (playerSettings) {
	    player = playerSettings;
	    player.name = playerName;
	    player.screenWidth = screenWidth;
	    player.screenHeight = screenHeight;
	    player.target = target;
	    socket.emit('gotit', player);
	    gameStart = true;
	    debug('Game is started: ' + gameStart);
	    chat.addSystemLine('Connected to the game!');
	    chat.addSystemLine('Type <b>-help</b> for a list of commands');
	    if (mobile) {
	    document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
	    }
	    document.getElementById('cvs').focus();
	    });

    socket.on('gameSetup', function(data) {
	    gameWidth = data.gameWidth;
	    gameHeight = data.gameHeight;
	    resize();
	    });

    socket.on('playerDied', function (data) {
	    chat.addSystemLine('Player <b>' + data.name + '</b> died!');
	    });

    socket.on('playerDisconnect', function (data) {
	    chat.addSystemLine('Player <b>' + data.name + '</b> disconnected!');
	    });

    socket.on('playerJoin', function (data) {
	    chat.addSystemLine('Player <b>' + data.name + '</b> joined!');
	    });

    socket.on('leaderboard', function (data) {
	    leaderboard = data.leaderboard;
	    var status = '<span class="title">Leaderboard</span>';
	    for (var i = 0; i < leaderboard.length; i++) {
	    status += '<br />';
	    if (leaderboard[i].id == player.id){
	    if(leaderboard[i].name.length !== 0)
	    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + ": " + Math.round(leaderboard[i].mass) + "</span>";
	    else
	    status += '<span class="me">' + (i + 1) + ". A cell unnamed" + ": " + Math.round(leaderboard[i].mass) + "</span>";
	    } else {
	    if(leaderboard[i].name.length !== 0)
	    status += (i + 1) + '. ' + leaderboard[i].name + ": " + Math.round(leaderboard[i].mass);
	    else
	    status += (i + 1) + '. A cell unnamed' + ": " + Math.round(leaderboard[i].mass);
	    }
	    }
	    //status += '<br />Players: ' + data.players;
	    document.getElementById('status').innerHTML = status;
	    });

    socket.on('serverMSG', function (data) {
	    chat.addSystemLine(data);
	    });

    // Chat
    socket.on('serverSendPlayerChat', function (data) {
	    chat.addChatLine(data.sender, data.message, false);
	    });

    // Handle movement
    socket.on('serverTellPlayerMove', function (userData, foodsList, massList) {
	    var playerData;
	    for(var i =0; i< userData.length; i++) {
	    if(typeof(userData[i].id) == "undefined") {
	    playerData = userData[i];
	    i = userData.length;
	    }
	    }
	    if(playerType == 'player') {
	    var xoffset = player.x - playerData.x;
	    var yoffset = player.y - playerData.y;

	    player.x = playerData.x;
	    player.y = playerData.y;
	    player.hue = playerData.hue;
	    player.massTotal = playerData.massTotal;
	    player.cells = playerData.cells;		    // my cells for splitting
	    player.xoffset = isNaN(xoffset) ? 0 : xoffset;
	    player.yoffset = isNaN(yoffset) ? 0 : yoffset;
	    }
	    users = userData;
	    foods = foodsList;
	    fireFood = massList;
    });

    // Die
    socket.on('RIP', function () {
	    gameStart = false;
	    died = true;
	    window.setTimeout(function() {
		document.getElementById('gameAreaWrapper').style.opacity = 0;
		document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
		died = false;
		if (animLoopHandle) {
		window.cancelAnimationFrame(animLoopHandle);
		animLoopHandle = undefined;
		}
		}, 2500);
	    });

    socket.on('kick', function (data) {
	    gameStart = false;
	    reason = data;
	    kicked = true;
	    socket.close();
	    });
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: drawCircle
 * Author: Wang Ziyuan
 * Description: Draw your circle according to center and radius
 * ===================================================================================== 
 */ 
function drawCircle(centerX, centerY, radius, sides) {
    var theta = 0;
    var x = 0;
    var y = 0;

    graph.beginPath();

    for (var i = 0; i < sides; i++) {
	theta = (i / sides) * 2 * Math.PI;
	x = centerX + radius * Math.sin(theta);
	y = centerY + radius * Math.cos(theta);
	graph.lineTo(x, y);
    }

    graph.closePath();
    graph.stroke();
    graph.fill();
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: draw ***
 * Author: cxy
 * Description: draw food, firefood, players on the canvas
 * ===================================================================================== 
 */ 
function drawFood(food) {
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
    graph.lineWidth = foodConfig.border;
    drawCircle(food.x - player.x + screenWidth / 2, food.y - player.y + screenHeight / 2, food.radius, food.sides);
}

/*  
 * === FUNCTION ====================================================================== 
 * Name: drawCircle
 * Author: Wang Ziyuan
 * Description: Draw the food you fire
 * ===================================================================================== 
 */
function drawFireFood(mass) {
    graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    graph.lineWidth = playerConfig.border+10;
    drawCircle(mass.x - player.x + screenWidth / 2, mass.y - player.y + screenHeight / 2, mass.radius-5, 18 + (~~(mass.masa/5)));
}
/*  
 * === FUNCTION ====================================================================== 
 * Name: drawCircle
 * Author: Wang Ziyuan
 * Description: Draw all  palyers
 * ===================================================================================== 
 */ 
function drawPlayers(order) {
    var start = {
x: player.x - (screenWidth / 2),
   y: player.y - (screenHeight / 2)
    };

    for(var z=0; z<order.length; z++)
    {
	var userCurrent = users[order[z].nCell];
	var cellCurrent = users[order[z].nCell].cells[order[z].nDiv];

	var x=0;
	var y=0;

	var points = 30 + ~~(cellCurrent.mass/5);
	var increase = Math.PI * 2 / points;

	graph.strokeStyle = 'hsl(' + userCurrent.hue + ', 100%, 45%)';
	graph.fillStyle = 'hsl(' + userCurrent.hue + ', 100%, 50%)';
	graph.lineWidth = playerConfig.border;

	var xstore = [];
	var ystore = [];

	spin += 0.0;

	var circle = {
x: cellCurrent.x - start.x,
   y: cellCurrent.y - start.y
	};

	for (var i = 0; i < points; i++) {

	    x = cellCurrent.radius * Math.cos(spin) + circle.x;
	    y = cellCurrent.radius * Math.sin(spin) + circle.y;
	    if(typeof(userCurrent.id) == "undefined") {
		x = valueInRange(-userCurrent.x + screenWidth / 2, gameWidth - userCurrent.x + screenWidth / 2, x);
		y = valueInRange(-userCurrent.y + screenHeight / 2, gameHeight - userCurrent.y + screenHeight / 2, y);
	    } else {
		x = valueInRange(-cellCurrent.x - player.x + screenWidth/2 + (cellCurrent.radius/3), gameWidth - cellCurrent.x + gameWidth - player.x + screenWidth/2 - (cellCurrent.radius/3), x);
		y = valueInRange(-cellCurrent.y - player.y + screenHeight/2 + (cellCurrent.radius/3), gameHeight - cellCurrent.y + gameHeight - player.y + screenHeight/2 - (cellCurrent.radius/3) , y);
	    }
	    spin += increase;
	    xstore[i] = x;
	    ystore[i] = y;
	}
	/*if (wiggle >= player.radius/ 3) inc = -1;
	 *if (wiggle <= player.radius / -3) inc = +1;
	 *wiggle += inc;
	 */
	for (i = 0; i < points; ++i) {
	    if (i === 0) {
		graph.beginPath();
		graph.moveTo(xstore[i], ystore[i]);
	    } else if (i > 0 && i < points - 1) {
		graph.lineTo(xstore[i], ystore[i]);
	    } else {
		graph.lineTo(xstore[i], ystore[i]);
		graph.lineTo(xstore[0], ystore[0]);
	    }

	}
	graph.lineJoin = 'round';
	graph.lineCap = 'round';
	graph.fill();
	graph.stroke();
	var nameCell = "";
	if(typeof(userCurrent.id) == "undefined")
	    nameCell = player.name;
	else
	    nameCell = userCurrent.name;

	var fontSize = Math.max(cellCurrent.radius / 3, 12);
	graph.lineWidth = playerConfig.textBorderSize;
	graph.fillStyle = playerConfig.textColor;
	graph.strokeStyle = playerConfig.textBorder;
	graph.miterLimit = 1;
	graph.lineJoin = 'round';
	graph.textAlign = 'center';
	graph.textBaseline = 'middle';
	graph.font = 'bold ' + fontSize + 'px sans-serif';

	if (toggleMassState === 0) {
	    graph.strokeText(nameCell, circle.x, circle.y);
	    graph.fillText(nameCell, circle.x, circle.y);
	} else {
	    graph.strokeText(nameCell, circle.x, circle.y);
	    graph.fillText(nameCell, circle.x, circle.y);
	    graph.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
	    if(nameCell.length === 0) fontSize = 0;
	    graph.strokeText(Math.round(cellCurrent.mass), circle.x, circle.y+fontSize);
	    graph.fillText(Math.round(cellCurrent.mass), circle.x, circle.y+fontSize);
	}
    }
}
//判断value在什么区间之内
function valueInRange(min, max, value) {
    return Math.min(max, Math.max(min, value));
}

function drawgrid() {
    graph.lineWidth = 1;
    graph.strokeStyle = lineColor;
    graph.globalAlpha = 0.15;
    graph.beginPath();

    for (var x = xoffset - player.x; x < screenWidth; x += screenHeight / 18) {
	graph.moveTo(x, 0);
	graph.lineTo(x, screenHeight);
    }

    for (var y = yoffset - player.y ; y < screenHeight; y += screenHeight / 18) {
	graph.moveTo(0, y);
	graph.lineTo(screenWidth, y);
    }

    graph.stroke();
    graph.globalAlpha = 1;
}

function drawborder() {
    graph.lineWidth = 1;
    graph.strokeStyle = playerConfig.borderColor;

    // Left-vertical
    if (player.x <= screenWidth/2) {
	graph.beginPath();
	graph.moveTo(screenWidth/2 - player.x, 0 ? player.y > screenHeight/2 : screenHeight/2 - player.y);
	graph.lineTo(screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
	graph.strokeStyle = lineColor;
	graph.stroke();
    }

    // Top-horizontal
    if (player.y <= screenHeight/2) {
	graph.beginPath();
	graph.moveTo(0 ? player.x > screenWidth/2 : screenWidth/2 - player.x, screenHeight/2 - player.y);
	graph.lineTo(gameWidth + screenWidth/2 - player.x, screenHeight/2 - player.y);
	graph.strokeStyle = lineColor;
	graph.stroke();
    }

    // Right-vertical
    if (gameWidth - player.x <= screenWidth/2) {
	graph.beginPath();
	graph.moveTo(gameWidth + screenWidth/2 - player.x, screenHeight/2 - player.y);
	graph.lineTo(gameWidth + screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
	graph.strokeStyle = lineColor;
	graph.stroke();
    }

    // Bottom-horizontal
    if (gameHeight - player.y <= screenHeight/2) {
	graph.beginPath();
	graph.moveTo(gameWidth + screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
	graph.lineTo(screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
	graph.strokeStyle = lineColor;
	graph.stroke();
    }
}

function gameInput(mouse) {
    if (!directionLock) {
	target.x = mouse.clientX - screenWidth / 2;
	target.y = mouse.clientY - screenHeight / 2;
    }
}

function touchInput(touch) {
    touch.preventDefault();
    touch.stopPropagation();
    if (!directionLock) {
	target.x = touch.touches[0].clientX - screenWidth / 2;
	target.y = touch.touches[0].clientY - screenHeight / 2;
    }
}

window.requestAnimFrame = (function() {
	return  window.requestAnimationFrame       ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame    ||
	window.msRequestAnimationFrame     ||
	function( callback ) {
	window.setTimeout(callback, 1000 / 60);
	};
	})();

window.cancelAnimFrame = (function(handle) {
	return  window.cancelAnimationFrame     ||
	window.mozCancelAnimationFrame;
	})();

function animloop() {
    animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (botStarted) {
	bot.heartBeat();          // TODO  temp
    }
    if (died) {
	// show the dead message
	graph.fillStyle = '#333333';
	graph.fillRect(0, 0, screenWidth, screenHeight);

	graph.textAlign = 'center';
	graph.fillStyle = '#FFFFFF';
	graph.font = 'bold 30px sans-serif';
	graph.fillText('You died!', screenWidth / 2, screenHeight / 2);
    }
    else if (!disconnected) {
	if (gameStart) {
	    graph.fillStyle = backgroundColor;
	    graph.fillRect(0, 0, screenWidth, screenHeight);
	    drawgrid();

	    foods.forEach(function(food) {
		    drawFood(food);
		    });

	    fireFood.forEach(function(mass) {
		    drawFireFood(mass);
		    });

	    if (borderDraw) {
		drawborder();
	    }
	    var orderMass = [];
	    for(var i=0; i<users.length; i++) {
		for(var j=0; j<users[i].cells.length; j++) {
		    orderMass.push({
nCell: i,
nDiv: j,
mass: users[i].cells[j].mass
});
}
}
orderMass.sort(function(obj1,obj2) {
	return obj1.mass - obj2.mass;
	});

drawPlayers(orderMass);
socket.emit('0', target); // playerSendTarget Heartbeat
} else {
    graph.fillStyle = '#333333';
    graph.fillRect(0, 0, screenWidth, screenHeight);

    graph.textAlign = 'center';
    graph.fillStyle = '#FFFFFF';
    graph.font = 'bold 30px sans-serif';
    graph.fillText('Game Over!', screenWidth / 2, screenHeight / 2);
}
} else {
    graph.fillStyle = '#333333';
    graph.fillRect(0, 0, screenWidth, screenHeight);

    graph.textAlign = 'center';
    graph.fillStyle = '#FFFFFF';
    graph.font = 'bold 30px sans-serif';
    if (kicked) {
	if (reason !== '') {
	    graph.fillText('You were kicked for reason:', screenWidth / 2, screenHeight / 2 - 20);
	    graph.fillText(reason, screenWidth / 2, screenHeight / 2 + 20);
	}
	else {
	    graph.fillText('You were kicked!', screenWidth / 2, screenHeight / 2);
	}
    }
    else {
	graph.fillText('Disconnected!', screenWidth / 2, screenHeight / 2);
    }
}
}

function randomString(len) {
    　　len = len || 32;
    　　var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
    　　var maxPos = $chars.length;
    　　var pwd = '';
    　　for (var i = 0; i < len; i++) {
	　　　　pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
	　　}
    　　return pwd;
}

/*  
 * === CLASS  ====================================================================== 
 * Name: smartBot
 * Author: Firebb
 * Description: Bot class
 * ===================================================================================== 
 */
function smartBot() {
    var io = require('socket.io-client');
    var playerName = "ghost" + randomString(5);
    var playerType = "player";		// not sure whether right;
    var socket;
    var reason;
    var borderDraw = false;
    var animLoopHandle;
    var mobile = false;
    var screenWidth = window.innerWidth;   // relate to client view
    var screenHeight = window.innerHeight;
    var gameWidth = 0;
    var gameHeight = 0;
    var xoffset = -gameWidth;
    var yoffset = -gameHeight;

    var gameStart = false;
    var disconnected = false;
    var died = false;
    var kicked = false;

    // player info
    var player = {
id: -1,                                               // player id
    x: screenWidth / 2,                                   // player always in the center of the screen
    y: screenHeight / 2,
    screenWidth: screenWidth,
    screenHeight: screenHeight,
    target: {x: screenWidth / 2, y: screenHeight / 2}
    };

    var foods = [];
    var fireFood = [];
    var users = [];
    var leaderboard = [];
    var target = {x: player.x, y: player.y};
    var reenviar = true;
    var directionLock = false;
    var directions = [];


    this.startGame = function(){
	screenWidth = window.innerWidth;
	screenHeight = window.innerHeight;
	if (!socket) {
	    socket = io({query:"type=" + playerType, forceNew: true});
	    this.setupSocket(socket);
	}
	socket.emit("respawn");
    };

    this.heartBeat = function(){
	var decision = this.mainLoop();
	var target = {x: decision[0], y: decision[1]};
	socket.emit("0",target);
    };

    this.setupSocket = function(socket) {

	// Handle error
	socket.on('connect_failed', function () {
		socket.close();
		disconnected = true;
		});

	socket.on('disconnect', function () {
		socket.close();
		disconnected = true;
		});

	// Handle connection
	socket.on('welcome', function (playerSettings) {
		player = playerSettings;
		player.name = playerName;
		player.screenWidth = 1960;
		player.screenHeight = 1080;
		player.target = target;
		socket.emit('gotit', player);
		gameStart = true;
		debug('Game is started: ' + gameStart);
		});


	socket.on('gameSetup', function(data) {
		gameWidth = data.gameWidth;
		gameHeight = data.gameHeight;
		});

	// TODO maybe restart bot here
	socket.on('playerDied', function (data) {
		});

	// TODO
	socket.on('playerDisconnect', function (data) {
		});

	socket.on('playerJoin', function (data) {
		});

	socket.on('leaderboard', function (data) {
		});

	socket.on('serverMSG', function (data) {
		});

	// Chat
	socket.on('serverSendPlayerChat', function (data) {
		});

	// Handle movement
	socket.on('serverTellPlayerMove', function (userData, foodsList, massList) {
		var playerData;
		for(var i =0; i< userData.length; i++) {
		if(typeof(userData[i].id) == "undefined") {
		playerData = userData[i];
		i = userData.length;
		}
		}
		if(playerType == 'player') {
		var xoffset = player.x - playerData.x;
		var yoffset = player.y - playerData.y;

		player.x = playerData.x;
		player.y = playerData.y;
		player.hue = playerData.hue;
		player.massTotal = playerData.massTotal;
		player.cells = playerData.cells;		    // my cells for splitting
		player.xoffset = isNaN(xoffset) ? 0 : xoffset;
		player.yoffset = isNaN(yoffset) ? 0 : yoffset;
		}
		users = userData;
		foods = foodsList;
		fireFood = massList;
	});

	// Die
	socket.on('RIP', function () {
		gameStart = false;
		died = true;
		});

	socket.on('kick', function (data) {
		gameStart = false;
		reason = data;
		kicked = true;
		socket.close();
		});
    };

    // Get a distance that is Inexpensive on the cpu for various purpaces
    this.computeInexpensiveDistance = function(x1, y1, x2, y2, s1, s2) {
	// Make sure there are no null optional params.
	s1 = s1 || 0;
	s2 = s2 || 0;
	var xdis = x1 - x2;
	var ydis = y1 - y2;
	// Get abs quickly
	xdis = xdis < 0 ? xdis * -1 : xdis;
	ydis = ydis < 0 ? ydis * -1 : ydis;

	var distance = xdis + ydis;

	return distance;
    };

    this.clusterFood = function(foodList, blobSize) {
	var clusters = [];
	var addedCluster = false;

	//1: x
	//2: y
	//3: size or value
	//4: Angle, not set here.

	for (var i = 0; i < foodList.length; i++) {
	    for (var j = 0; j < clusters.length; j++) {
		if (this.computeInexpensiveDistance(foodList[i].x, foodList[i].y, clusters[j].x, clusters[j].y) < blobSize * 2) {
		    clusters[j].x = (foodList[i].x + clusters[j].x) / 2;
		    clusters[j].y = (foodList[i].y + clusters[j].y) / 2;
		    if (foodList[i].mass) {
			cluster[j].mass += foodList[i].mass;
		    }
		    else {
			clusters[j].mass += 1;  // each food score 1
		    }
		    addedCluster = true;
		    break;
		}
	    }
	    if (!addedCluster) {
		if (foodList[i].mass) {
		    clusters.push([foodList[i].x, foodList[i].y, foodList[i].mass, 0]);
		}
		else {
		    clusters.push([foodList[i].x, foodList[i].y, 1, 0]);
		}
	    }
	    addedCluster = false;
	}
	return clusters;
    };

    this.computeDistance = function(x1, y1, x2, y2) {
	var xdis = x1 - x2; // <--- FAKE AmS OF COURSE!
	var ydis = y1 - y2;
	var distance = Math.sqrt(xdis * xdis + ydis * ydis);

	return distance;
    };

    this.getAngle = function(x1, y1, x2, y2) {
	//Handle vertical and horizontal lines.

	if (x1 == x2) {
	    if (y1 < y2) {
		return 271;
		//return 89;
	    } else {
		return 89;
	    }
	}

	return (Math.round(Math.atan2(-(y1 - y2), -(x1 - x2)) / Math.PI * 180 + 180));
    };

    this.slope = function(x1, y1, x2, y2) {
	var m = (y1 - y2) / (x1 - x2);

	return m;
    };

    this.slopeFromAngle = function(degree) {
	if (degree == 270) {
	    degree = 271;
	} else if (degree == 90) {
	    degree = 91;
	}
	return Math.tan((degree - 180) / 180 * Math.PI);
    };

    //Given two points on a line, finds the slope of a perpendicular line crossing it.
    this.inverseSlope = function(x1, y1, x2, y2) {
	var m = this.slope(x1, y1, x2, y2);
	return (-1) / m;
    };

    //Given a slope and an offset, returns two points on that line.
    this.pointsOnLine = function(slope, useX, useY, distance) {
	var b = useY - slope * useX;
	var r = Math.sqrt(1 + slope * slope);

	var newX1 = (useX + (distance / r));
	var newY1 = (useY + ((distance * slope) / r));
	var newX2 = (useX + ((-distance) / r));
	var newY2 = (useY + (((-distance) * slope) / r));

	return [
	    [newX1, newY1],
	    [newX2, newY2]
		];
    };

    this.followAngle = function(angle, useX, useY, distance) {
	var slope = this.slopeFromAngle(angle);
	var coords = this.pointsOnLine(slope, useX, useY, distance);

	var side = this.mod(angle - 90, 360);
	if (side < 180) {
	    return coords[1];
	} else {
	    return coords[0];
	}
    };

    //Using a line formed from point a to b, tells if point c is on S side of that line.
    this.isSideLine = function(a, b, c) {
	if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0) {
	    return true;
	}
	return false;
    };

    //angle range2 is within angle range2
    //an Angle is a point and a distance between an other point [5, 40]
    this.angleRangeIsWithin = function(range1, range2) {
	if (range2[0] == this.mod(range2[0] + range2[1], 360)) {
	    return true;
	}
	//console.log("r1: " + range1[0] + ", " + range1[1] + " ... r2: " + range2[0] + ", " + range2[1]);

	var distanceFrom0 = this.mod(range1[0] - range2[0], 360);
	var distanceFrom1 = this.mod(range1[1] - range2[0], 360);

	if (distanceFrom0 < range2[1] && distanceFrom1 < range2[1] && distanceFrom0 < distanceFrom1) {
	    return true;
	}
	return false;
    };

    this.angleRangeIsWithinInverted = function(range1, range2) {
	var distanceFrom0 = this.mod(range1[0] - range2[0], 360);
	var distanceFrom1 = this.mod(range1[1] - range2[0], 360);

	if (distanceFrom0 < range2[1] && distanceFrom1 < range2[1] && distanceFrom0 > distanceFrom1) {
	    return true;
	}
	return false;
    };

    this.angleIsWithin = function(angle, range) {
	var diff = this.mod(this.rangeToAngle(range) - angle, 360);
	if (diff >= 0 && diff <= range[1]) {
	    return true;
	}
	return false;
    };

    this.rangeToAngle = function(range) {
	return this.mod(range[0] + range[1], 360);
    };

    this.anglePair = function(range) {
	return (range[0] + ", " + this.rangeToAngle(range) + " range: " + range[1]);
    };

    this.getAngleIndex = function(listToUse, angle) {
	if (listToUse.length === 0) {
	    return 0;
	}

	for (var i = 0; i < listToUse.length; i++) {
	    if (angle <= listToUse[i][0]) {
		return i;
	    }
	}

	return listToUse.length;
    };

    this.addAngle = function(listToUse, range) {
	//#1 Find first open element
	//#2 Try to add range1 to the list. If it is within other range, don't add it, set a boolean.
	//#3 Try to add range2 to the list. If it is withing other range, don't add it, set a boolean.

	//TODO: Only add the new range at the end after the right stuff has been removed.

	var newListToUse = listToUse.slice();
	var i = 0;

	var startIndex = 1;

	if (newListToUse.length > 0 && !newListToUse[0][1]) {
	    startIndex = 0;
	}

	var startMark = this.getAngleIndex(newListToUse, range[0][0]);
	var startBool = this.mod(startMark, 2) != startIndex;

	var endMark = this.getAngleIndex(newListToUse, range[1][0]);
	var endBool = this.mod(endMark, 2) != startIndex;

	var removeList = [];

	if (startMark != endMark) {
	    //Note: If there is still an error, this would be it.
	    var biggerList = 0;
	    if (endMark == newListToUse.length) {
		biggerList = 1;
	    }

	    for (i = startMark; i < startMark + this.mod(endMark - startMark, newListToUse.length + biggerList); i++) {
		removeList.push(this.mod(i, newListToUse.length));
	    }
	} else if (startMark < newListToUse.length && endMark < newListToUse.length) {
	    var startDist = this.mod(newListToUse[startMark][0] - range[0][0], 360);
	    var endDist = this.mod(newListToUse[endMark][0] - range[1][0], 360);

	    if (startDist < endDist) {
		for (i = 0; i < newListToUse.length; i++) {
		    removeList.push(i);
		}
	    }
	}

	removeList.sort(function(a, b){return b-a;});

	for (i = 0; i < removeList.length; i++) {
	    newListToUse.splice(removeList[i], 1);
	}

	if (startBool) {
	    newListToUse.splice(this.getAngleIndex(newListToUse, range[0][0]), 0, range[0]);
	}
	if (endBool) {
	    newListToUse.splice(this.getAngleIndex(newListToUse, range[1][0]), 0, range[1]);
	}

	return newListToUse;
    };

    //TODO: Don't let this function do the radius math.
    this.getEdgeLinesFromPoint = function(blob1, blob2, radius) {
	var px = blob1.x;
	var py = blob1.y;

	var cx = blob2.x;
	var cy = blob2.y;

	//var radius = blob2.size;

	/*if (blob2.isVirus()) {
	  radius = blob1.size;
	  } else if(canSplit(blob1, blob2)) {
	  radius += splitDistance;
	  } else {
	  radius += blob1.size * 2;
	  }*/

	var shouldInvert = false;

	var tempRadius = this.computeDistance(px, py, cx, cy);
	if (tempRadius <= radius) {
	    radius = tempRadius - 5;
	    shouldInvert = true;
	}

	var dx = cx - px;
	var dy = cy - py;
	var dd = Math.sqrt(dx * dx + dy * dy);
	var a = Math.asin(radius / dd);
	var b = Math.atan2(dy, dx);

	var t = b - a;
	var ta = {
x: radius * Math.sin(t),
   y: radius * -Math.cos(t)
	};

	t = b + a;
	var tb = {
x: radius * -Math.sin(t),
   y: radius * Math.cos(t)
	};

	var angleLeft = this.getAngle(cx + ta.x, cy + ta.y, px, py);
	var angleRight = this.getAngle(cx + tb.x, cy + tb.y, px, py);
	var angleDistance = this.mod(angleRight - angleLeft, 360);

	/*if (shouldInvert) {
	  var temp = angleLeft;
	  angleLeft = this.mod(angleRight + 180, 360);
	  angleRight = this.mod(temp + 180, 360);
	  angleDistance = this.mod(angleRight - angleLeft, 360);
	  }*/

	return [angleLeft, angleDistance, [cx + tb.x, cy + tb.y],
	       [cx + ta.x, cy + ta.y]
		   ];
    };

    this.invertAngle = function(range) { // Where are you getting all of these vars from? (badAngles and angle)
	var angle1 = this.rangeToAngle(badAngles[i]);
	var angle2 = this.mod(badAngles[i][0] - angle, 360);
	return [angle1, angle2];
    };

    this.addWall = function(listToUse, blob) {
	//var mapSizeX = Math.abs(f.getMapStartX - f.getMapEndX);
	//var mapSizeY = Math.abs(f.getMapStartY - f.getMapEndY);
	//var distanceFromWallX = mapSizeX/3;
	//var distanceFromWallY = mapSizeY/3;
	var distanceFromWallY = 4 + Math.sqrt(blob.massTotal) * 6;
	var distanceFromWallX = distanceFromWallY;
	if (blob.x < distanceFromWallX) {
	    //LEFT
	    //console.log("Left");
	    listToUse.push([
		    [90, true],
		    [270, false], this.computeInexpensiveDistance(0, blob.y, blob.x, blob.y)
		    ]);
	}
	if (blob.y < distanceFromWallY) {
	    //TOP
	    //console.log("TOP");
	    listToUse.push([
		    [180, true],
		    [360, false], this.computeInexpensiveDistance(blob.x, 0, blob.x, blob.y)
		    ]);
	}
	if (blob.x > gameWidth - distanceFromWallX) {
	    //RIGHT
	    //console.log("RIGHT");
	    listToUse.push([
		    [270, true],
		    [90, false], this.computeInexpensiveDistance(gameWidth, blob.y, blob.x, blob.y)
		    ]);
	}
	if (blob.y > gameHeight - distanceFromWallY) {
	    //BOTTOM
	    //console.log("BOTTOM");
	    listToUse.push([
		    [0, true],
		    [180, false], this.computeInexpensiveDistance(blob.x, gameHeight, blob.x, blob.y)
		    ]);
	}
	return listToUse;
    };

    this.getAngleRange = function(blob1, blob2, index, radius) {
	var angleStuff = this.getEdgeLinesFromPoint(blob1, blob2, radius);

	var leftAngle = angleStuff[0];
	var rightAngle = this.rangeToAngle(angleStuff);
	var difference = angleStuff[1];

	return [leftAngle, difference];
    };

    this.mod = function(num, mod) {
	if (mod & (mod - 1) === 0 && mod !== 0) {
	    return num & (mod - 1);
	}
	return num < 0 ? ((num % mod) + mod) % mod : num % mod;
    };

    //Given a list of conditions, shift the angle to the closest available spot respecting the range given.
    this.shiftAngle = function(listToUse, angle, range) {
	//TODO: shiftAngle needs to respect the range! DONE?
	for (var i = 0; i < listToUse.length; i++) {
	    if (this.angleIsWithin(angle, listToUse[i])) {
		//console.log("Shifting needed!");

		var angle1 = listToUse[i][0];
		var angle2 = this.rangeToAngle(listToUse[i]);

		var dist1 = this.mod(angle - angle1, 360);
		var dist2 = this.mod(angle2 - angle, 360);

		if (dist1 < dist2) {
		    if (this.angleIsWithin(angle1, range)) {
			return angle1;
		    } else {
			return angle2;
		    }
		} else {
		    if (this.angleIsWithin(angle2, range)) {
			return angle2;
		    } else {
			return angle1;
		    }
		}
	    }
	}
	//console.log("No Shifting Was needed!");
	return angle;
    };

    this.mainLoop = function() {

	var allPossibleFood = foods.slice();
	var allPossibleThreats = [];
	//The bot works by removing angles in which it is too
	//dangerous to travel towards to.
	var badAngles = [];
	var obstacleList = [];
	var i = 0;
	var j = 0;

	for(i=0; i<users.length; i++) {
	    var curUser = users[i];
	    if (typeof(curUser.id) == "undefined") {
	    }
	    else {
		for (j=0; j < curUser.cells.length; j++) {
		    // temprorily use massTotal to represent whole mass
		    if (curUser.cells[j].mass >= player.massTotal * 1.1) {
			allPossibleThreats.push(curUser.cells[j]);
		    }
		    else if (curUser.cells[j].mass * 1.1 <= player.massTotal) {
			foods.push({x:curUser.cells[j].x, y:curUser.cells[j].y, mass:curUser.cells[j].mass}); 
		    }
		}
	    }
	}

	// get all food cluster
	var clusterAllFood = this.clusterFood(allPossibleFood, player.cells[0].radius);
	var tempOb;
	var angle1;
	var angle2;
	var diff;

	for (i = 0; i < allPossibleThreats.length; i++) {

	    var enemyDistance = this.computeDistance(allPossibleThreats[i].x, allPossibleThreats[i].y, player.cells[0].x, player.cells[0].y);
	    allPossibleThreats[i].enemyDist = this.computeDistance(allPossibleThreats[i].x, allPossibleThreats[i].y, player.x, player.y, allPossibleThreats[i].radius);

	    var splitDangerDistance = allPossibleThreats[i].radius + splitDistance + 150;

	    var normalDangerDistance = allPossibleThreats[i].radius + 150;

	    var shiftDistance = player.cells[0].radius;

	    //console.log("Found distance.");

	    var enemyCanSplit = (allPossibleThreats[i].mass >= player.massTotal * 2.2) ? true:false;
	    var secureDistance = (enemyCanSplit ? splitDangerDistance : normalDangerDistance);

	    for (j = clusterAllFood.length - 1; j >= 0 ; j--) {
		if (this.computeDistance(allPossibleThreats[i].x, allPossibleThreats[i].y, clusterAllFood[j].x, clusterAllFood[j].y) < secureDistance + shiftDistance)
		    clusterAllFood.splice(j, 1);
	    }

	    //console.log("Removed some food.");

	    if ((enemyCanSplit && enemyDistance < splitDangerDistance) ||
		    (!enemyCanSplit && enemyDistance < normalDangerDistance)) {

		allPossibleThreats[i].danger = true;
	    }

	    //console.log("Figured out who was important.");

	    if ((enemyCanSplit && enemyDistance < splitDangerDistance)) {

		badAngles.push(this.getAngleRange(player, allPossibleThreats[i], i, splitDangerDistance).concat(allPossibleThreats[i].enemyDist));

	    } else if ((!enemyCanSplit && enemyDistance < normalDangerDistance)) {

		badAngles.push(this.getAngleRange(player, allPossibleThreats[i], i, normalDangerDistance).concat(allPossibleThreats[i].enemyDist));

	    } else if (enemyCanSplit && enemyDistance < splitDangerDistance + shiftDistance) {
		tempOb = this.getAngleRange(player, allPossibleThreats[i], i, splitDangerDistance + shiftDistance);
		angle1 = tempOb[0];
		angle2 = this.rangeToAngle(tempOb);

		obstacleList.push([[angle1, true], [angle2, false]]);
	    } else if (!enemyCanSplit && enemyDistance < normalDangerDistance + shiftDistance) {
		tempOb = this.getAngleRange(player, allPossibleThreats[i], i, normalDangerDistance + shiftDistance);
		angle1 = tempOb[0];
		angle2 = this.rangeToAngle(tempOb);

		obstacleList.push([[angle1, true], [angle2, false]]);
	    }
	    //console.log("Done with enemy: " + i);
	}

	var goodAngles = [];
	var stupidList = [];

	stupidList = this.addWall(stupidList, player);

	for (i = 0; i < badAngles.length; i++) {
	    angle1 = badAngles[i][0];
	    angle2 = this.rangeToAngle(badAngles[i]);
	    stupidList.push([[angle1, true], [angle2, false], badAngles[i][2]]);
	}

	stupidList.sort(function(a, b){
		return a[2]-b[2];
		});

	var sortedInterList = [];
	var sortedObList = [];

	for (i = 0; i < stupidList.length; i++) {
	    //console.log("Adding to sorted: " + stupidList[i][0][0] + ", " + stupidList[i][1][0]);
	    var tempList = this.addAngle(sortedInterList, stupidList[i]);

	    if (tempList.length === 0) {
		console.log("MAYDAY IT'S HAPPENING!");
		break;
	    } else {
		sortedInterList = tempList;
	    }
	}

	for (i = 0; i < obstacleList.length; i++) {
	    sortedObList = this.addAngle(sortedObList, obstacleList[i]);

	    if (sortedObList.length === 0) {
		break;
	    }
	}

	var obstacleAngles = [];
	var offsetI = 0;
	var obOffsetI = 1;

	if (sortedInterList.length > 0 && sortedInterList[0][1]) {
	    offsetI = 1;
	}
	if (sortedObList.length > 0 && sortedObList[0][1]) {
	    obOffsetI = 0;
	}

	for (i = 0; i < sortedInterList.length; i += 2) {
	    angle1 = sortedInterList[this.mod(i + offsetI, sortedInterList.length)][0];
	    angle2 = sortedInterList[this.mod(i + 1 + offsetI, sortedInterList.length)][0];
	    diff = this.mod(angle2 - angle1, 360);
	    goodAngles.push([angle1, diff]);
	}

	for (i = 0; i < sortedObList.length; i += 2) {
	    angle1 = sortedObList[this.mod(i + obOffsetI, sortedObList.length)][0];
	    angle2 = sortedObList[this.mod(i + 1 + obOffsetI, sortedObList.length)][0];
	    diff = this.mod(angle2 - angle1, 360);
	    obstacleAngles.push([angle1, diff]);
	}

	var destinationChoices;
	if (goodAngles.length > 0) {
	    var bIndex = goodAngles[0];
	    var biggest = goodAngles[0][1];
	    for (i = 1; i < goodAngles.length; i++) {
		var size = goodAngles[i][1];
		if (size > biggest) {
		    biggest = size;
		    bIndex = goodAngles[i];
		}
	    }
	    var perfectAngle = this.mod(bIndex[0] + bIndex[1] / 2, 360);

	    perfectAngle = this.shiftAngle(obstacleAngles, perfectAngle, bIndex);

	    var line1 = this.followAngle(perfectAngle, 0, 0, screenWidth/2);

	    destinationChoices = line1;
	} else if (badAngles.length > 0 && goodAngles.length === 0) {
	    //When there are enemies around but no good angles
	    //You're likely screwed. (This should never happen.)

	    destinationChoices = [target.x, target.y];
	} else if (clusterAllFood.length > 0) {
	    for (i = 0; i < clusterAllFood.length; i++) {
		//console.log("mefore: " + clusterAllFood[i][2]);
		//This is the cost function. Higher is better.

		var clusterAngle = this.getAngle(clusterAllFood[i][0], clusterAllFood[i][1], player.x, player.y);

		clusterAllFood[i][2] = clusterAllFood[i][2] * 300 - this.computeDistance(clusterAllFood[i][0], clusterAllFood[i][1], player.x, player.y);
		//console.log("Current Value: " + clusterAllFood[i][2]);

		//(goodAngles[bIndex][1] / 2 - (Math.abs(perfectAngle - clusterAngle)));

		clusterAllFood[i][3] = clusterAngle;

		//console.log("After: " + clusterAllFood[i][2]);
	    }

	    var bestFoodI = 0;
	    var bestFood = clusterAllFood[0][2];
	    for (i = 1; i < clusterAllFood.length; i++) {
		if (bestFood < clusterAllFood[i][2]) {
		    bestFood = clusterAllFood[i][2];
		    bestFoodI = i;
		}
	    }

	    //console.log("Best Value: " + clusterAllFood[bestFoodI][2]);

	    var bestFx=clusterAllFood[bestFoodI][0];
	    var bestFy=clusterAllFood[bestFoodI][1];
	    var distance = this.computeDistance(player.x, player.y, bestFx, bestFy);
	    var destination = [(bestFx - player.x) * (screenHeight/2) / distance, (bestFy - player.y) * (screenHeight/2) / distance];


	    destinationChoices = destination;
	} else {
	    destinationChoices = [target.x, target.y];
	}
	return destinationChoices;

    };
    this.startGame();

}


window.addEventListener('resize', resize);

function resize() {
    player.screenWidth = c.width = screenWidth = playerType == 'player' ? window.innerWidth : gameWidth;
    player.screenHeight = c.height = screenHeight = playerType == 'player' ? window.innerHeight : gameHeight;
    socket.emit('windowResized', { screenWidth: screenWidth, screenHeight: screenHeight });
}

