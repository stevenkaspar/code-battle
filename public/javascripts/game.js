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

    socket.on('game_state',       this.handleGameState.bind(this));
    socket.on('new_player',       this.handleNewPlayer.bind(this));
    socket.on('new_piece',        this.handleNewPiece.bind(this));
    socket.on('move_piece',       this.handleMovePiece.bind(this));
    socket.on('update_piece',     this.handleUpdatePiece.bind(this));
    socket.on('update_piece_key', this.handleUpdatePieceKey.bind(this));
    socket.on('remove_piece',     this.handleRemovePiece.bind(this));
    socket.on('piece_animation',  this.handlePieceAnimation.bind(this));
    socket.on('piece_direction',  this.handlePieceDirection.bind(this));
    socket.on('game_update',      this.handleGameUpdate.bind(this));
  }

  handleGameState(game_state){
    this.game_state = game_state;

    if(!this.ready){
      return;
    }

    for(let p of this.game_state.pieces){
      let piece  = null;
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

  handleNewPlayer(player){
    console.log(player);
  }
  handleNewPiece(piece){
    this.addNewPiece(piece);
  }
  handleMovePiece(piece, new_x, new_y){
    let local_piece = this.findPieceById(piece._id);
    if(!local_piece){
      this.handleNewPiece(piece);
    }
    else {
      local_piece.setPosition(new_x, new_y);
    }
  }
  handleUpdatePieceKey(piece_id, key, value){
    let local_piece = this.findPieceById(piece_id);
    local_piece[key] = value;
  }
  handleUpdatePiece(piece){
    let local_piece = this.findPieceById(piece._id);
    local_piece.updateData(piece);
  }
  handleRemovePiece(piece){
    let entity = app.root.findByName(Piece.nameFromId(piece._id));
    entity.destroy();
    for(let i = 0, l = this.pieces.length; i < l; i++){
      if(this.pieces[i]._id === piece._id){
        this.pieces.splice(i, 1);
        break;
      }
    }
  }
  handlePieceAnimation(piece_id, animation){
    let local_piece = this.findPieceById(piece_id);
    if(!local_piece) return;
    local_piece.animation = animation;
  }
  handlePieceDirection(piece_id, direction){
    let local_piece = this.findPieceById(piece_id);
    if(!local_piece) return;
    local_piece.direction = direction;
  }
  handleGameUpdate(update){
    console.log(update);
  }

  findPieceById(piece_id){
    for(let piece of this.pieces){
      if(piece._id === piece_id){
        return piece;
      }
    }
    return null;
  }

  addNewPiece(piece_data){
    let piece = eval(`new ${piece_data.type}(piece_data);`);
    this.pieces.push(piece);
    return piece;
  }

  addPlayer(name, pin){
    return Fetch.post(endpoints.add_player, {
      name: name,
      pin:  pin
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
        tile.model.material = app.assets.find('brown').resource;
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

    let light_2 = new pc.Entity('light');
    light_2.addComponent('light');
    light_2.setEulerAngles(50, 0, 60);
    app.root.addChild(light_2);
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

    const assets = [
      {
        url: `/files/models/home.json`,
        name: 'home',
        type: 'model'
      },
      {
        url: `/files/models/warrior.json`,
        name: 'warrior',
        type: 'model'
      },
      {
        url: `/files/colors/brown.json`,
        name: 'brown',
        type: 'material'
      },
      {
        url: `/files/colors/green.json`,
        name: 'green',
        type: 'material'
      },
      {
        url: `/files/colors/red.json`,
        name: 'red',
        type: 'material'
      },
      {
        url: `/files/colors/blue.json`,
        name: 'blue',
        type: 'material'
      },
      {
        url: `/files/colors/white.json`,
        name: 'white',
        type: 'material'
      },
      {
        url: `/files/animations/warrior-running.json`,
        name: 'warrior-running',
        type: 'animation'
      },
      {
        url: `/files/animations/warrior-idle.json`,
        name: 'warrior-idle',
        type: 'animation'
      },
      {
        url: `/files/animations/warrior-attacking.json`,
        name: 'warrior-attacking',
        type: 'animation'
      }
    ];

    for(let asset of assets){
      let new_asset = new pc.Asset(asset.name, asset.type, {
        url: asset.url
      })
      promises.push(new Promise((resolve, reject) => {
        new_asset.on('load', resolve);
      }))
      app.assets.add(new_asset);
      app.assets.load(new_asset);
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
    this._id     = piece_data._id;
    this.x       = piece_data.x;
    this.y       = piece_data.y;
    this.player  = piece_data.player;
    this._color  = piece_data.color;
  }

  set color(value){
    this._color = value;
    this.colorModel();
  }

  set direction(value){
    this.entity.setEulerAngles(0, 0, value);
  }

  set animation(value){
    // have to setup if should do something
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

    this.entity.setPosition(this.getX(), this.getY(), this.getZ());
  }

  getZ(){
    const scale = this.entity.getLocalScale();
    return scale.z * .5;
  }

  getX(){
    return this.x + .5;
  }
  getY(){
    return this.y + .5;
  }

  colorModel(color){
    // if color, set it
    if(color){
      this._color = color;
    }
    // if no color and no color yet, use red
    else if(!color && !this._color){
      this._color = 'red';
    }
    for(let i = 0, l = this.entity.model.model.meshInstances.length; i < l; i++){
      this.entity.model.model.meshInstances[i].material = app.assets.find(this._color).resource;
    }
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
    let entity      = new pc.Entity(Piece.nameFromId(this._id));
    this.entity = entity;

    let model_asset = app.assets.find('home');
    entity.addComponent('model', {
      type: 'asset',
      asset: model_asset
    });
    let entity_scale = entity.getLocalScale();
    entity_scale.x = .8;
    entity_scale.y = .8;
    entity_scale.z = .95;
    entity.setLocalScale(entity_scale);
    entity.setPosition(this.getX(), this.getY(), this.getZ());

    this.placeEntity(entity);
  }

}

class Warrior extends Piece {

  constructor(warrior_data){
    super(warrior_data);
    this.build();
  }

  set animation(value){
    console.log(value);
    if(value === 'idle'){
      this.entity.animation.play(`warrior-running`, 0);
      this.entity.animation.play(`warrior-attacking`, 0);
    }
    this.entity.animation.play(`warrior-${value}`, 0);
  }

  build(){
    let entity = new pc.Entity(Piece.nameFromId(this._id));
    this.entity = entity;

    let model_asset = app.assets.find('warrior');
    let model = entity.addComponent('model', {
      type: 'asset',
      asset: model_asset
    });

    let animation_running = app.assets.find('warrior-running');
    let animation_idle = app.assets.find('warrior-idle');
    let animation_attacking = app.assets.find('warrior-attacking');
    entity.addComponent('animation', {
      assets: [
        animation_idle,
        animation_running,
        animation_attacking
      ],
      activate: false,
      enabled: true,
      loop: true,
      speed: 1.8
    });

    this.entity.animation.activate = true;


    let entity_scale = entity.getLocalScale();
    entity_scale.x = .003;
    entity_scale.y = .003;
    entity_scale.z = .003;
    entity.setLocalScale(entity_scale);
    entity.setPosition(this.getX(), this.getY(), this.getZ());

    this.placeEntity(entity);
  }

  getZ(){
    return .5;
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
  constructor(player, pin){
    this._id    = player._id;
    this.name   = player.name;
    this.pin    = pin;
    this.pieces = [];
    this.coder  = new Coder('Code', 'SubmitCodeBtn', this.setCode.bind(this));
    this.coder.cm.setSize('100%', '100%');


    this.joinSocket();
    socket.on('update_code', this.handleUpdateCode.bind(this));
  }

  joinSocket(){
    socket.emit('join_game', this._id, this.pin);
  }

  handleUpdateCode(code){
    if(this.coder.cm.getValue() !== code){
      this.coder.cm.setValue(code);
      this.coder.last_submitted_value = code;
    }
  }

  setCode(code){
    return Fetch.post(endpoints.set_code, {
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
    this.cm.on('change', this.handleOnChange.bind(this));


    this.submit = document.getElementById(submit_id);
    this.submit.addEventListener('click', this.handleSubmitClick.bind(this));
    this._last_submitted_value = '';

    this.submitCb  = submitCb;

    this.populateInitialInstructions();
  }

  get last_submitted_value(){
    return this._last_submitted_value;
  }

  set last_submitted_value(value){
    this._last_submitted_value = value;

    this.handleOnChange();
  }

  handleOnChange(){
    const cur_val = this.cm.getValue();
    this.submit.disabled = (this._last_submitted_value === cur_val);
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
    let value                 = this.cm.getValue();
    this._last_submitted_value = value;
    this.submitCb(value).then(response => {
      console.log(response);
      this._last_submitted_value = value;
      this.submit.disabled = true;
    });
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

  game.loadAssets().then(() => {
    boardReady();
    game.loadGameState();
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
    const pin  = join_form.player_pin.value;

    game.addPlayer(name, pin).then(response => {
      log.clear();
      if(response.success){
        join_overlay.parentNode.removeChild(join_overlay);
        new Player(response.player, pin);
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
