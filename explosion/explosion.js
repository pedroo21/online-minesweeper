var canvas;
var cWidth;
var cHeight;
var context;
var stars = [];
var t;

function initAnimations() {
    canvas = document.getElementById("effects-game");
    cWidth = canvas.width;
    cHeight = canvas.height;
    context = canvas.getContext('2d');
}

function Star(x, y, speed, dir, life, color) {
    var _this = this;
    
    this.x = x;
    this.y = y;
    this.color = color;
    
    var xInc = Math.cos(dir) * speed;
    var yInc = Math.sin(dir) * speed;
    
    this.life = life;
    
    this.update = function() {   
        this.x += xInc;
        this.y += yInc;
        this.life--;      
    }
}

function removeStars() {   
    for(var l = stars.length-1, i = l; i >= 0; i--) {
        if(stars[i].life < 0) {
            stars[i] = stars[stars.length-1];
            stars.length--;
        }
    }
}

function clear() {
    context.clearRect(0, 0, cWidth, cHeight);
}

function draw() {

    //context.fillStyle = "#000000"
    removeStars();
    
    for(var i = 0; i < stars.length; i++) {
        var s = stars[i];
        context.fillStyle = s.color;
        context.fillRect(s.x-2, s.y-2, 3, 3);
        s.update();
    }    
}

function update() {

    if(t != null)
        clearTimeout(t);

    clear();
    draw();
    
    t = setTimeout(update, 33); 
}

function stopAnimations() {
    if(t == null)
        return;
    clearTimeout(t);
    clear();
    stars = [];
    document.getElementById("effects-game").style.zIndex = -1;
}

function makeStars(coordX, coordY) {
    var starAmt = Math.random()*20 + 50;

    for(var i = 0; i < starAmt; i++) {    
        var dir = Math.random()*2*Math.PI;
        var speed = Math.random()*3 + 2;
        var life = Math.random()*10 + 10;
        stars[stars.length] = new Star(coordX, coordY, speed, dir, life, getRandomColor()); 
    }
}

function getRandomColor() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}