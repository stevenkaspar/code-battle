'use strict'
// create a PlayCanvas application
//

var canvas;
var app;
var socket = io.connect();

// Classes

const endpoints = {
  game_state: '/api/game_state',
  add_player: '/api/add_player',
  set_code:   '/api/set_code'
}

class Fetch {

  static get(url){
    return fetch(url).then(response => {
      return response.json();
    })
  }

  static post(url, body){
    body.meta = Fetch.meta();

    return fetch(url, {
      method: 'post',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }).then(response => {
      return response.json();
    })
  }

  static meta(){
    return {
      timestamp: Date.now()
    }
  }
}

class Game {
  constructor(){
    this.game_state = {};
    this.pieces     = [];
    this.entities   = [];
    this.ready      = false;

    socket.on('game_state', this.handleGameState.bind(this));
  }

  handleGameState(game_state){
    this.game_state = game_state;

    if(!this.ready){
      return;
    }

    for(let p of this.game_state.pieces){
      var piece  = null;
      let entity = app.root.findByName(Piece.nameFromId(p._id));

      if(entity === null){
        piece = this.addNewPiece(p);
      }
      if(piece === null){
        for(let existing_p of this.pieces){
          if(existing_p._id === p._id){
            piece = existing_p;
            break;
          }
        }
      }
      piece.updateData(p);
    }

  }

  addNewPiece(piece_data){
    let piece = eval(`new ${piece_data.type}(piece_data);`);
    this.pieces.push(piece);
    return piece;
  }

  addPlayer(name){
    return Fetch.post(endpoints.add_player, {
      name: name
    });
  }

  createGrid(grid_size){
    if(!grid_size){
      grid_size = 20;
    }
    for(var x = 1; x <= grid_size; x++){
      for(var y = 1; y <= grid_size; y++){
        // create box entity
        let tile = new pc.Entity('tile');
        tile.addComponent('model', {
          type: 'box'
        });
        let tile_scale = tile.getLocalScale();
        tile_scale.x = .95;
        tile_scale.y = .95;
        tile_scale.z = .1;
        tile.setLocalScale(tile_scale);
        tile.setPosition(x - .5, y - .5, -(tile_scale.z * .5));
        tile.model.material = app.assets.find('white').resource;
        app.root.addChild(tile);
      }
    }
  }

  createCamera(){
    // create camera entity
    let camera = new pc.Entity('camera');
    camera.addComponent('camera', {
      clearColor: new pc.Color(0.3, 0.45, 0.65),
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      orthoHeight: 5
    });
    camera.rotate(60, 0, -45);
    camera.setPosition(-2, -2, 6);
    app.root.addChild(camera);
  }

  createLight(){
    let light = new pc.Entity('light');
    light.addComponent('light');
    light.setEulerAngles(90, 0, 60);
    app.root.addChild(light);
  }

  createAxis(){
    var axiis = [
      { name: 'axis-x', x: 1000, y: .01, z: .01 },
      { name: 'axis-y', x: .01, y: 1000, z: .01 },
      { name: 'axis-z', x: .01, y: .01, z: 1000 }
    ];
    for(let a of axiis){
      let axis = new pc.Entity('axis');
      axis.addComponent('model', {
        type: 'box'
      });
      let axis_scale = axis.getLocalScale();
      axis_scale.x = a.x;
      axis_scale.y = a.y;
      axis_scale.z = a.z;
      axis.setLocalScale(axis_scale);
      axis.setPosition(0, 0, 0);
      app.root.addChild(axis);
    }
  }

  loadAssets(){
    let promises = [];

    const colors = ['red' ,'blue', 'white'];

    for(let color of colors){
      let asset = new pc.Asset(color, 'material', {
        url: `/files/colors/${color}.json`
      })
      promises.push(new Promise((resolve, reject) => {
        asset.on('load', resolve);
      }))
      app.assets.add(asset);
      app.assets.load(asset);
    }

    return Promise.all(promises);
  }

  loadGameState(){
    return new Promise((resolve, reject) => {
      Fetch.get(endpoints.game_state).then(game_state => {
        this.handleGameState(game_state);
        resolve(game_state);
      });
    })
  }
}


class Piece {
  constructor(piece_data){
    this._id    = piece_data._id;
    this.x      = piece_data.x;
    this.y      = piece_data.y;
    this.player = piece_data.player;
    this.color  = piece_data.color;
  }

  updateData(piece_data){
    this.setPosition(piece_data.x, piece_data.y);
    this.colorModel(piece_data.color);
  }

  placeEntity(){
    app.root.addChild(this.entity);
    this.colorModel();
  }

  setPosition(x, y){
    this.x = x;
    this.y = y;

    this.entity.setPosition(this.x, this.y, .95);
  }

  colorModel(color){
    // if color, set it
    if(color){
      this.color = color;
    }
    // if no color and no color yet, use red
    else if(!color && !this.color){
      this.color = 'red';
    }
    this.entity.model.material = app.assets.find(this.color).resource;
  }

  static nameFromId(_id){
    return `piece_${_id}`;
  }
}

class Home extends Piece {

  constructor(home_data){
    super(home_data);
    this.build();
  }

  build(){
    let entity = new pc.Entity(Piece.nameFromId(this._id));
    entity.addComponent('model', {
      type: 'box'
    });
    let entity_scale = entity.getLocalScale();
    entity_scale.x = .8;
    entity_scale.y = .8;
    entity_scale.z = .95;
    entity.setLocalScale(entity_scale);
    entity.setPosition(this.x - .5, this.y - .5, (entity_scale.z * .5));

    this.entity = entity;

    this.placeEntity(entity);
  }

}

class Warrior extends Piece {

  constructor(warrior_data){
    super(warrior_data);
    this.build();
  }

  build(){
    let entity = new pc.Entity(Piece.nameFromId(this._id));
    entity.addComponent('model', {
      type: 'box'
    });
    let entity_scale = entity.getLocalScale();
    entity_scale.x = .4;
    entity_scale.y = .4;
    entity_scale.z = .75;
    entity.setLocalScale(entity_scale);
    entity.setPosition(this.x - .5, this.y - .5, (entity_scale.z * .5) + .25);

    this.entity = entity;

    this.placeEntity(entity);
  }

}

class Log {
  constructor(element_id){
    this.element = document.getElementById(element_id);

    socket.on('log', this.socketLog.bind(this));
  }

  set(value){
    this.element.innerHTML = value;
  }

  clear(){
    this.set('');
  }

  info(value){
    value = `<span class='text-info'>${value}</span>`;
    this.log(value);
  }
  success(value){
    value = `<span class='text-success'>${value}</span>`;
    this.log(value);
  }
  error(value){
    value = `<span class='text-danger'>${value}</span>`;
    this.log(value);
  }
  log(value){
    const top     = this.element.scrollTop;
    const height  = this.element.scrollHeight;
    const oHeight = this.element.offsetHeight;
    // using a supposed_height because there was an extra pixel in there
    // sometimes. It also adds some wiggle room if user is not all the way down
    const supposed_height = (height - oHeight);

    let scroll_after_log = (top <= supposed_height + 10 && top >= supposed_height - 10);

    this.element.innerHTML += `${value}<br/>`;

    if(scroll_after_log){
      this.element.scrollTop = this.element.scrollHeight;
    }
  }

  socketLog(value, type){
    value = value.toString().replace(/\\n/g, '\n');
    this[type ? type : 'log'](value);
  }
}


class Player {
  constructor(_id){
    this._id    = _id;
    this.pieces = [];
    this.coder  = new Coder('Code', 'SubmitCodeBtn', this.setCode.bind(this));
    this.coder.cm.setSize('100%', '100%');

    this.joinSocket();
  }

  joinSocket(){
    socket.emit('join_game', this._id);
  }

  setCode(code){
    Fetch.post(endpoints.set_code, {
      player_id: this._id,
      code:      code
    })
  }
}

class Coder {
  constructor(textarea_id, submit_id, submitCb){
    this.cm = CodeMirror.fromTextArea(document.getElementById(textarea_id), {
      lineWrapping: true,
      lineNumbers: true,
      mode: 'javascript'
    });
    this.submit = document.getElementById(submit_id);
    this.submit.addEventListener('click', this.handleSubmitClick.bind(this));
    this.submitCb = submitCb;

    this.populateInitialInstructions();
  }

  populateInitialInstructions(){
    const instructions = `// You can log using to the gray console area
//
log('', 'clear');
log(\`Pieces: `+'${player.pieces.length}`'+`, 'success');
for(let p of player.pieces){
  log(\`Piece: `+'${p._id} \\n x: ${p.x}\\n y: ${p.y}\n health: ${p.health}`'+`, 'info');
}

// You're code will be evaluated every 5 seconds
// You can take action with your player using the player variable
//
// player.build(Home,    4, 4);
// player.build(Wall,    4, 5);
// player.build(Warrior, 4, 6);


// All of the build functions return the piece
//
// let home = player.build(Home, 4, 4);
// home.health = 10000000; // try this and see the warning


// If you need to get a piece you can iterate your player's pieces
//
// for(let piece of player.pieces){
//   if(piece.movable){
//      piece.x += 1;
//   }
// }
`;

    this.cm.setValue(instructions);
  }

  handleSubmitClick(e){
    let value = this.cm.getValue();
    this.submitCb(value);
  }
}

//--- Classes



let init = () => {
  canvas = document.getElementById('Application');
  app = new pc.Application(canvas, {});

  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  app.start();


  // ensure canvas is resized when window changes size
  window.addEventListener('resize', () => {
    app.resizeCanvas();
  });

  let game = new Game();
  // game.createAxis();
  game.createCamera();
  game.createLight();

  game.loadGameState().then(game_state => {
    game.loadAssets().then(boardReady);
  })

  let boardReady = () => {
    game.createGrid(10);
    game.ready = true;
  }



  let log = new Log('Log');
  log.clear();
  log.log(`
<h1>Welcome to code-battle</h1>
        / \\
       /  /
      /  /
     /  /
    /  /
/--------/
  /  /
 /__/

    `);

  let join_overlay = document.getElementById('JoinOverlay');
  let join_form    = document.getElementById('JoinForm');

  join_form.addEventListener('submit', e => {
    e.preventDefault();

    const name = join_form.player_name.value;

    game.addPlayer(name).then(response => {
      log.clear();
      if(response.success){
        join_overlay.parentNode.removeChild(join_overlay);
        new Player(response.player._id);
      }
      else {
        log.error(response.message);
      }
    });
  })


  // register a global update event
  app.on('update', deltaTime => {

  });
}

document.addEventListener('DOMContentLoaded', init);
