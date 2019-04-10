// This object is used to track the graphical state of the game
// All graphical sizes should be relative to simon so that if needs be in the future the game can be scaled using the multiplier factor
var grphState = {
  // The browser window width and height are used for relative values 
  // They need to be set using an EventListener outside the object
  winW:1,
  winH:1,
  // Calculate the center of the screen
  get cent(){
    return this.winW/2;},

  mult:1, 
  get simonSize(){
    return 100 * this.mult;},
  
  // How tall the room relative to simon
  get roomH(){
    return this.simonSize * 4;}, // <- 4 times simons height

  // The height of the button 
  get buttonH(){
    return this.simonSize/4;}, // <- 1/4 simons height

  get buttonW(){
    return this.simonSize*1.2;}, // <- 1/5 bigger than simons width
  
  // How wide the pillar is relative to simon
  get pillarW(){
    return this.simonSize * 2;}, // <- 2 times as wide as simon
  
  // This value is set depending on the browser height
  get pillarH(){
    return (this.winH-this.roomH)/2;},

  // pillarGap is the relative size of the gap between pillars 
  pillarGapR:0.5, // <- 1/2 the pillar width
  get pillarGapW(){
    return this.pillarGapR*this.pillarW;},

  // This value is the pillar gap and width combined so it is used as a pillar 'unit' for some calculations
  get pillarWGapW(){
    return this.pillarW + this.pillarGapW;},

  // This value is the maximum number of pillars that could fit on the screen
  // The value is used to calculate if the game room needs to be centered on the screen 
  get pillarNum(){
    return Math.ceil(this.winW/(this.pillarWGapW));},

  // This keeps track of what pillar simon is on
  pillarNumCount:0,

  // An array to store the generated pillar locations
  pillarArray:[],

  // Where the pillars start on the canvas
  pillarStart:0,

  // Location of where the right hand wall starts, the left wall starts at 0 so does not need a value stored
  rWallX:0
};

// Global flags to monitor game state
var animationFlag = false;
var buttonFlag = false;
var zapFlag = false;

// Function used to start listening for screen resizes and draws the first canvas at the current screensize
function initialize() {

  // Listener for canvas resize
  window.addEventListener('resize', resizeCanvas, false);
  
  // Initialize the canvas on first loading the page
  resizeCanvas();
  
  // Initial Draw, hard coded at 7 pillars but should be a splash screen in the future
  initDraw(7);

  // Start animation ticker
  createjs.Ticker.framerate = (60);
  createjs.Ticker.addEventListener("tick", loopDraw);
  createjs.MotionGuidePlugin.install();
}

// Functions used to dynamically resize the canvas to the device size, Runs each time the DOM window resize event fires.
// http://htmlcheats.com/html/resize-the-html5-canvas-dyamically/
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  grphState.winW = window.innerWidth;
  grphState.winH = window.innerHeight;

  // It's brutal but for the moment if the game has started it forces a gameover as it is difficult to recalculate the locations of everything on the fly and maintain the gamestate. If the game hasn't started then the room is drawn normally 
  if (startFlag){
    gameOver();
    initDraw(7); // Same hard coded future splash screen
  }
  else{
    initDraw(grphState.pillarArray.length);
  }


}

// Draw function used to 'set the stage'
function initDraw(num){

  // Start by clearing whatever is already on the stage
  stage.removeAllChildren();

  // Generate a room, this should be changed for a splash screen in future
  generateRoom(num);

  // Calculate the position of simon for the center of the first pillar of the room
  // Note: most of the time since simon's x position is relative to his center and the pillar is generated from the top left, half a pillar width has to be added or accounted for 
  var simonX = grphState.pillarArray[0]+grphState.pillarW/2;
  var simonY = grphState.pillarH + grphState.roomH;
  
  // Draw the generated room, simon and add them both to the stage
  drawRoom();
  simon = drawSimon(simonX, simonY);
  stage.addChild(simon);
  stage.addChild(room);
  stage.update();
}

// This is the main loop of the game and is ticked using the EventListener started in the initialize function above. As of now it contains everything that happens in the game. Once the room is generated and stage set, it watches for when a move is made by the player, that move and it's type is added to the game queue and then processed as either a pillar jump move or a hazard move. Those moves are then checked and animated. 
function loopDraw(){

  // Just before the loop runs, if the user inputs more moves than game moves this ensures that they are removed before they cause trouble 
  gameOverflow();

  // If a new pillar has been added or the button has been pushed the room is redrawn
  // In the if condition: -4 is minus 2 walls, the button and the hazard container
  if ((grphState.pillarArray.length != (room.children.length - 4)/2) || buttonFlag == true){
    
    // Clear everything before restarting
    stage.removeAllChildren();
    room.removeAllChildren();
    hazards.removeAllChildren();

    // Resets the button and animation flags and resets the move counter
    buttonFlag = false;
    animationFlag = false;
    gameState.userMoveCount = 0;

    // Calculate the position of simon for the first pillar and reset the pillar counter
    var simonX = grphState.pillarArray[0]+grphState.pillarW/2;
    var simonY = grphState.pillarH + grphState.roomH;
    grphState.pillarNumCount = 0;

    // Draw the room, simon and add them to the stage
    drawRoom();
    room.regX = 0; // This re-centers the room if it was scrolled previously 
    simon = drawSimon(simonX, simonY);
    stage.addChild(simon);
    stage.addChild(room);
    stage.update();
  }

  var uml = gameState.userMoves.length; // Number of user move 
  var tml = gameState.typeMovesTrack.length; // Number of the types of game moves (hazard or jump)
  var gml = gameState.gameMoves.length; // Number of raw game moves (L,R,U,D)

  // If a new move is added to the users move list then that move type is removed from the move tracker and pushed to the queue to be animated. This move tracking system is used so that animations finish playing before the next one starts 
  if (tml > (gml-uml)){
    gameState.typeMoveQ.push(gameState.typeMoves[tml-1]);
    gameState.typeMovesTrack.pop();
  }

  // The position of simon is relative to the main stage whereas the position of the button is relative to the room which itself is a child of the stage. Since this is the case the stage position of the button is calculated and used to compare against the location of simon  
  var button = room.children[0]; // The button is always the first child of the room container set out in the drawRoom function
  var buttonG = button.localToGlobal(0,0);
  var buttonX = buttonG.x - ((grphState.buttonW)/2);
  var buttonY = buttonG.y - grphState.buttonH;


  // If the number of user moves is the same as game moves and simon is over the button the button should be pushed
  // This could maybe use HitTest https://createjs.com/tutorials/HitTest/
  if (gml == uml && simon.x > buttonX){
    // Once simons y starts to overlap with the top of the button the button is moved down  
    if (simon.y >= (buttonY)){
      button.y = (simon.y + grphState.buttonH);
      // Once simon 'lands' on the button the game pauses and then resets for the next room
      if (animationFlag == false){
        console.log('ButtonPressed');
        animationFlag = true; // Animation Flag is set
        // After a pause the game resets
        setTimeout(function(){buttonFlag = true; gameCheck(); console.log('Next Level');}, 500);
      }
    }
  }

  // If simon gets half way along the screen his position is locked and the room around him should scroll instead
  if (simon.x > grphState.cent){
    simon.x = grphState.cent;
  }

  // If a jump move is made then simon will jump from pillar to pillar. This will need to check the direction that was pushed as at the moment the game will abruptly end if the wrong key is pressed. In the future simon could jump backwards but should animate a failure (eg electrocution?)
  if (gameState.typeMoveQ[0] == 'Jump' && animationFlag == false){
    animationFlag = true; // Animation Flag is set
    var at = 500; // Animation time in ms
    var pn = grphState.pillarNumCount; // Pillar number
    var ps = grphState.pillarArray[pn] + grphState.pillarW/2; // Pillar Start x
    var pe = grphState.pillarArray[pn+1] + grphState.pillarW/2; // Pillar End x
    var ph = grphState.pillarH + grphState.roomH; // Pillar Height 
    var rh = grphState.roomH; // Room Height
    var pd = ps + (pe-ps)/2; // Half the pillar distance, used in the animation below

    // If the distance to the next pillar is over the half way mark then the room is scrolled instead of simon so the x movement for simon is set to 0
    if (grphState.pillarArray[pn+1] > grphState.cent){
      var pe2 = pe - simon.x;
      ps = simon.x;
      pe = simon.x;
      pd = simon.x;

      // Since simon jumps along a quadratic curve, d/dx is linear meaning this linear animation is fine, I was worried for a minute it wasn't 
      createjs.Tween.get(room)
        .to({regX: pe2}, at);
    }

    // Otherwise if simon is not beyod the center he is animated normally
    createjs.Tween.get(simon)
      .to({guide:{ path:[ps,ph, pd,ph-(rh/2),pe,ph] }},at)
      .wait(50)
      .call(function(){
        animationFlag = false;
        gameCheck(gameState.userMoveCount);
        gameState.userMoveCount++;});
    
    // The completed move is removed from the move queue
    gameState.typeMoveQ.shift(); 

    // The pillar number counter is incremented 
    grphState.pillarNumCount++;
    
  }

  // If a hazard move is made then simon will avoid a hazard
  else if (gameState.typeMoveQ[0] == 'Hazard' && animationFlag == false){
    animationFlag = true; // Animation Flag is set
    var pn = grphState.pillarNumCount; // Pillar number
    var pi = (grphState.pillarNumCount * 2)-1; // Pillar index of the current pillar for arrays
    var ph = grphState.pillarH + grphState.roomH; //Pillar Height
    var pw = grphState.pillarW; // Pillar Width
    var rh = grphState.roomH; // Room Height

    // If the move is an up, simon jumps up  
    if (gameState.userMoves[pi].includes('Up')){
      zapFlag = true; // Starts the electric bolts
      createjs.Tween.get(simon)
        .to({y: ph-(rh/4)}, 100)
        .to({y: ph}, 200)
      .call(function(){
        animationFlag = false;
        zapFlag = false;
        lightningStriker();
        gameCheck(gameState.userMoveCount);
        gameState.userMoveCount++;});
    }
    // If the move is a down, simon ducks
    else if (gameState.userMoves[pi].includes('Down')){
      var ah = grphState.pillarH - grphState.roomH; // Arm height
      hazards.addChild(drawMSP(grphState.pillarArray[pn], ah));
      var hi = hazards.children.length - 1; // Hazard Index
      // Animate the Mashy Spike Plate
      createjs.Tween.get(hazards.children[hi])
        .to({regY:-rh + grphState.simonSize/2}, 120)
        .wait(200)
        .to({regY:0}, 180);
      // Animate simon
      createjs.Tween.get(simon)
        .to({scaleY: 0.25}, 100) // <- Ducks 1/4 height
        .wait(200)
        .to({scaleY: 1}, 200)
        .wait(100)
      .call(function(){
        animationFlag = false;
        gameCheck(gameState.userMoveCount);
        gameState.userMoveCount++;});
    }
    // If the move is a left, simon dodges left
    else if (gameState.userMoves[pi].includes('Left')){
      var sx = grphState.pillarArray[pn] + (grphState.pillarW*0.66); // Spike x
      hazards.addChild(drawSpike(sx, ph, pw/4, grphState.simonSize));
      var hi = hazards.children.length - 1; // Hazard Index
      // Animate the Spike
      createjs.Tween.get(hazards.children[hi])
        .to({regY:grphState.simonSize}, 120)
        .wait(200)
        .to({regY:0}, 120);
      // Animate simon
      createjs.Tween.get(simon)
        .to({regX: (pw/2)}, 100)
        .wait(200)
        .to({regX: 0}, 200)
        .wait(100)
      .call(function(){
        animationFlag = false;
        gameCheck(gameState.userMoveCount);
        gameState.userMoveCount++;});
    }
    // If the move is a right, simon dodges right
    else if (gameState.userMoves[pi].includes('Right')){
      var sx = grphState.pillarArray[pn] + (grphState.pillarW*0.33); // Spike x
      hazards.addChild(drawSpike(sx, ph, pw/4, grphState.simonSize));
      var hi = hazards.children.length - 1; // Hazard Index
      // Animate the Spike
      createjs.Tween.get(hazards.children[hi])
        .to({regY:grphState.simonSize}, 120)
        .wait(200)
        .to({regY:0}, 120);
      // Animate simon
      createjs.Tween.get(simon)
        .to({regX: -(pw/2)}, 100)
        .wait(200)
        .to({regX: 0}, 200)
        .wait(100)
      .call(function(){
        animationFlag = false;
        gameCheck(gameState.userMoveCount);
        gameState.userMoveCount++;});
    }

    // The game is checked for gameover
    gameCheck(gameState.userMoveCount);

    // The completed move is removed from the move queue
    gameState.typeMoveQ.shift();
  }

  // Once the electricity has been started by the Up move a bolt is added, then every tick the bolt is removed and a newly generated bolt is added 
  // https://stackoverflow.com/questions/36724818/remove-shapes-with-specific-name-form-stage-in-easeljs/36728703
  if (zapFlag){
    // Removes the previous bolt
    lightningStriker();

    var bs = grphState.pillarArray[grphState.pillarNumCount]; // Bolt start
    var by = grphState.pillarH + grphState.roomH + 5; // Bolt y position
    var bl = grphState.pillarW; // Bolt lenght
    hazards.addChild(drawBolt(bs, by, bl));
  }

  // Update the stage every tick
  stage.update();
}

// This function is used to calculate the positions of the pillars and walls for the room
function generateRoom(pill){

  // Clear the pillar array 
  grphState.pillarArray = [];

  // This is used to center pillars on the screen if there are too few to fill the screen
  if (pill < grphState.pillarNum){
    grphState.pillarStart = calcPillarStart(pill);
  }
  // Otherwise they are drawn from the far left side
  else{
    grphState.pillarStart = 105;
  }
  // Calculating pillar coordinates
  for (let i = 0; i < pill; i++) {
    grphState.pillarArray.push(grphState.pillarStart+((grphState.pillarWGapW)*i));
  }
  grphState.rWallX = calcrWallX(pill);

}

// This function is used to calculate where the pillars should start based on the center of the room. 
  // The location to start drawing pillars was calculated using the two formulas:
  // center - (((pillar number-1)/2)*(pillar width+pillar gap))+pillar width/2 for odd numbers
  // center - ((pillar number/2)*(pillar width+pillar gap))-pillar width/8 for even numbers
  // Turns out these equations reduce to the same formula which is used below
  // Note that the formulas above used a hard coded value for the gap between pillars, now the formula below uses a more general form using pillarGap
function calcPillarStart(pill){

  var c = grphState.cent;
  var pw = grphState.pillarW;
  var pg = grphState.pillarGapR;

  return c - ((pw/2)*((pg*(pill-1))+pill)) + 5;
}

// This function calculates where the right-hand wall starts, counting however many pillar 'units' but not forgetting the last pillar has no gap following
function calcrWallX(pill){

  var ps = grphState.pillarStart;
  var pwgw = grphState.pillarWGapW;
  var pgw = grphState.pillarGapW;

  return ps+((pwgw)*pill)-pgw-5;
}

// This function clears the room and redraws a generated room
// Note that all objects that are drawn in other functions are loaded at 0,0 then shifted to the specified x,y coordinates. This was done so that it is easier to track the locations of the objects on the canvas 
function drawRoom(){

  // Clear everything from the room
  room.removeAllChildren();

  var pn = grphState.pillarArray.length; // Pillar number
  var name; // Name variable which is used to give each object a unique name, the name has no real function but for help debugging 

  // Button first so that it animates behind things
  room.addChild(drawButton((grphState.pillarArray[pn-1]+(grphState.pillarW/2)), grphState.pillarH + grphState.roomH));

  // Same with the hazards containter
  room.addChild(hazards);

  // Top Pillars
  for (let i = 0; i < pn; i++) {
    name = 'TopPillar' + (i+1);
    room.addChild(drawPillar(grphState.pillarArray[i], 0, name));
  }
  // Bottom Pillars
  for (let i = 0; i < pn; i++) {
    name = 'BottomPillar' + (i+1);
    room.addChild(drawPillar(grphState.pillarArray[i], grphState.pillarH + grphState.roomH, name));
  }
  // Left Wall
  room.addChild(drawWall(0,0,grphState.pillarStart+5, grphState.winH, 'LeftWall'));
  // Right Wall
  room.addChild(drawWall(grphState.rWallX,0,1000, grphState.winH, 'RightWall'));
}

// Returns a simon shape which must be added to either the stage or a container
function drawSimon(x, y) {

  // Centering simon
  var ss = grphState.simonSize;
  // var xn = x - ss/2;
  // var yn = y - ss;

  // Create a new graphics object at the 'centered' 0,0
  var graphics = new createjs.Graphics();
  graphics.beginFill('#0095DD');
  graphics.rect(-(ss/2),-ss,ss,ss);
  
  // Draw dot where the object is drawn from for debugging
  // graphics.beginFill('#000000');
  // graphics.rect(0,0,2,2);

  // The object is then shifted to the specified x,y and given a name
  var simn = new createjs.Shape(graphics);
  simn.x = x;
  simn.y = y;
  simn.name = 'Simon';
  
  return (simn);
}

// Returns a pillar shape which must be added to either the stage or a container
function drawPillar(x, y, name){

  // Create a new graphics object at 0,0
  var graphics = new createjs.Graphics();
  graphics.beginFill('#999999'); // <- The color of the pillar
  graphics.rect(0,0,grphState.pillarW,grphState.pillarH);
  
  // Draw dot where the object is drawn from for debugging
  // graphics.beginFill('#000000');
  // graphics.rect(0,0,2,2);

  // The object is then shifted to the specified x,y and given a name
  var pllr = new createjs.Shape(graphics);
  pllr.x = x;
  pllr.y = y;
  pllr.name = name;

  return (pllr);

}

// Returns a wall shape which must be added to either the stage or a container
function drawWall(x, y, w, h, name){

  // Create a new graphics object at 0,0
  var graphics = new createjs.Graphics();
  graphics.beginFill('#999999'); // <- The color of the wall
  graphics.rect(0,0,w,h);
  
  // Draw dot where the object is drawn from for debugging
  // graphics.beginFill('#000000');
  // graphics.rect(0,0,2,2);

  // The object is then shifted to the specified x,y and given a name
  var wall = new createjs.Shape(graphics);
  wall.x = x;
  wall.y = y;
  wall.name = name;

  return (wall);

}

// Returns a button shape which must be added to either the stage or a container
function drawButton(x, y){

  // Centering button
  var bw = grphState.buttonW;
  var bh = grphState.buttonH;
  // var xn = x - bw/2;
  // var yn = y - bh;

  // Create a new graphics object at 0,0
  var graphics = new createjs.Graphics();
  graphics.beginFill('#FF0000'); // <- The color of the button
  graphics.rect(-((bw)/2), -(bh), bw, bh);
  
  // Draw dot where the object is drawn from for debugging
  // graphics.beginFill('#000000');
  // graphics.rect(0,0,2,2);

  // The object is then shifted to the specified x,y and given a name
  var bttn = new createjs.Shape(graphics);
  bttn.setBounds(x,y,bw, bh); // The button was also given bounds which might be used for hit detection in the future
  bttn.x = x;
  bttn.y = y;
  bttn.name = 'Button';

  return (bttn);

}

// Returns a new randomly generated squigily bolt of lightning
function drawBolt(x, y, w){

  // Create a graphics object
  var graphics = new createjs.Graphics();
  graphics.setStrokeStyle(3);
  graphics.beginStroke('#FDD023');

  // Set two arrays to store the random x,y values for the line with a start at 0,0
  var zapx = [0];
  var zapy = [0];

  // While the total length of the line is less that the above width w, a random length with a random y value are added to the line arrays
  // https://stackoverflow.com/questions/1230233/how-to-find-the-sum-of-an-array-of-numbers
  while (zapx.reduce(function(acc, val) { return acc + val; }, 0) < w){
    // The value of 20 was chosen by trial and error, may need to be changed or even made an input of the function
    zapx.push(Math.random()*(w/20)); 
    zapy.push(-(Math.random()*20));
  }

  // This should remove any overflow of the specified width from the line 
  while (zapx.reduce(function(acc, val) { return acc + val; }, 0) > w){
    zapx.pop();
  }

  // Set the last values of the arrays to the same start point
  zapx.push(0);
  zapy.push(0);

  // For all the line segments build up a continuous electric line 
  // A line is drawn from temp to temp + the next random length, then the random length is added to temp so the next section of line will start from the same point
  var temp = zapx[0];
  for (var i = 0; i < zapx.length; i++) {
    graphics.moveTo(temp,zapy[i]).lineTo(temp+zapx[i],zapy[i+1]);
    temp += zapx[i];
  }

  // The object is then shifted to the specified x,y and given a name
  var bolt = new createjs.Shape(graphics);
  bolt.x = x;
  bolt.y = y;
  bolt.name = 'Bolt';

  return (bolt);

}

// Returns a large spike shape which must be added to either the stage or a container
function drawSpike(x, y, w, h){

  // Create a new graphics object at the 'centered' 0,0
  var graphics = new createjs.Graphics();
  graphics.beginFill('#BBBBBB');
  graphics.moveTo(0,0).lineTo(w/2,h).lineTo(-w/2,h).closePath();

  // The object is then shifted to the specified x,y
  var spike = new createjs.Shape(graphics);
  spike.x = x;
  spike.y = y;
  spike.name = 'Spike';
  
  return (spike);

}

// Returns a Mashy Spike Plate, straight from the boys down at Aperture Science
function drawMSP(x, y){

  var pw = grphState.simonSize/4; // Plate Height and Arm Width

  // Create a new graphics object
  var graphics = new createjs.Graphics();
  graphics.beginFill('#BBBBBB');
  
  // MSP Arm 
  // Note the arm is as long as the room so that when it extends it can reach far enough
  graphics.rect((grphState.pillarW/2)-(pw/2),0,pw, grphState.roomH);
  
  // MSP Plate
  graphics.rect(0,grphState.roomH-pw,(grphState.pillarW*0.95), pw);
  
  // MSP Spikes, 9 for every plate
  var step = grphState.pillarW/10;
  var start = step/2 + (grphState.pillarW/40); // Start in at a fraction of the plate width
  // Looping 9 times adding a spike at each step
  for (var i = 0; i < 9; i++) {
    graphics.moveTo(start+(step/2),grphState.roomH)
      .lineTo(start,grphState.roomH+(pw*0.75))
      .lineTo(start-(step/2),grphState.roomH)
      .closePath();
    start += step;
  }
  
  // The object is then shifted to the specified x,y and given a name
  var msp = new createjs.Shape(graphics);
  msp.x = x;
  msp.y = y;
  msp.name = 'Mashy Spike Plate';
  
  return (msp);

}

// This small function removes lightning from the hazards container, it needs to be a function so that when the Up animation ends it can remove the last bolt
function lightningStriker(){

  for (var i=hazards.children.length - 1; i>=0; i--) {
    var hchild = hazards.getChildAt(i);
    if (hchild.name == 'Bolt'){
      hazards.removeChild(hchild);
    } 
  }
  
}
