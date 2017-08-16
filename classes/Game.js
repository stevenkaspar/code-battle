'use strict';

const sleep = require('sleep');

class Game {
  constructor(){
    this.players = [];

    this.players_sockets = {};

    this.players_turn_data = {};

    this.pieces_hash = {};

    this.current_size = 10;


    // this.count = 0;
    this.in_evals_update_interval = null;
    this.in_eval_update_timeout   = null;
    this.eval_game_states         = [];

    this.Player = require('./Player')(this);

    this._time = 0;

    // UPDATE_INTERVAL_MS is how often the game_state
    // gets sent to sockets
    this.UPDATE_INTERVAL_MS = 250;
    // EVAL_INTERVAL_MS is how often the evalCode loop
    // gets executed
    this.EVAL_INTERVAL_MS   = 5000;

    // - 1000 so 1 second padding
    this.ALOTTED_EVAL_MS = this.EVAL_INTERVAL_MS - 1000;

    this.EVAL_CODE_TIMEOUT_MS = 3000;

    this.MAX_PLAYERS = this.ALOTTED_EVAL_MS / this.EVAL_CODE_TIMEOUT_MS;

    console.log(`MAX_PLAYERS: ${this.MAX_PLAYERS}`);

    this.start();
  }

  setIo(io){
    this.io = io;
    this.addIoListeners();
  }

  addIoListeners(){
    this.io.on('connection', socket => {

      let player_id = null;

      socket.emit('game_state', this.getState());

      socket.on('join_game', (_player_id, pin) => {

        this.findPlayer(_player_id).then(player => {

          // set the socket-global player_id
          player_id = _player_id;

          if(player.pin !== pin){
            console.log('INVALID SOCKET PIN - HACKER');
            socket.emit('game_state', {});
            socket.disconnect();
            return;
          }

          if(!this.players_sockets[player_id]){
            this.players_sockets[player_id] = [];
          }

          this.players_sockets[player_id].push(socket);

          player.log(`Welcome, ${player.name}`);

          if(player.code){
            socket.emit('update_code', player.code);
          }

        })
        socket.emit('game_state', this.getState());
      });

      socket.on('disconnect', () => {

        if(!this.players_sockets[player_id]){
          return;
        }

        const i = this.players_sockets[player_id].indexOf(socket);

        this.players_sockets[player_id].splice(i, 1);

      })

    });
  }

  getState(){
    return {
      players: this.players.map(p => p.getState()),
      pieces:  this.piecesHashToArray().map(p => {
        return Object.assign(p.piece.getState(), {x: p.x, y: p.y});
      })
    }
  }

  piecesHashToArray(filterFn){
    let return_array = [];
    let typeof_filterFn = typeof filterFn;
    for(let k in this.pieces_hash){
      let x_y_split = k.split(/_/i);
      let x = parseInt(x_y_split[0]);
      let y = parseInt(x_y_split[1]);

      let piece_data = Object.assign({}, this.pieces_hash[k], {x: x, y: y})

      if(typeof_filterFn === 'function'){
        if(filterFn(piece_data)){
          return_array.push(piece_data);
        }
      }
      else {
        return_array.push(piece_data);
      }
    }
    return return_array;
  }

  start(){
    this.updateInterval = setInterval(
      this.update.bind(this)
      , this.UPDATE_INTERVAL_MS);
  }
  /**
   * returns a randomly sorted array of players
   * so that evaluated code is not always in the same
   * order
   */
  getPlayerOrder() {
    var array      = this.players;
    var curr_index = array.length;
    var temp_value;
    var rand_index;

    // While there remain elements to shuffle...
    while (0 !== curr_index) {

      // Pick a remaining element...
      rand_index = Math.floor(Math.random() * curr_index);
      curr_index -= 1;

      // And swap it with the current element.
      temp_value        = array[curr_index];
      array[curr_index] = array[rand_index];
      array[rand_index] = temp_value;
    }

    return array;
  }

  update(){
    const num_players = this.players.length;

    // eval players code
    if(this._time % this.EVAL_INTERVAL_MS === 0 && num_players > 0){

      // go through players randomly and evalCode
      for(let p of this.getPlayerOrder()){
        // set turn data so we know what they had at start of turn
        this.setPlayerTurnData(p);
        // eval the player code
        p.evalCode();
        // clear turn data so we are ready next round
        this.clearPlayerTurnData(p);
      }

    }

    this._time += this.UPDATE_INTERVAL_MS;
  }

  setPlayerTurnData(player){
    this.players_turn_data[player._id] = {
      home_count:    player.homes.length,
      warrior_count: player.warriors.length,
      home_builds:    0,
      warrior_builds: 0,
    };
  }
  clearPlayerTurnData(player){
    this.players_turn_data[player._id] = {};

    for(let p of player.pieces){
      this.send('piece_animation', p._id, 'idle');
    }

  }

  addPlayer(name, pin){
    return new Promise((resolve, reject) => {
      let player = this.findPlayerByName(name);

      if(!player){
        player = new this.Player(name, pin);

        player.init().then(player => {
          this.players.push(player);
          this.io.sockets.emit('new_player', player.getState());
          resolve(player);
        })
      }
      else {
        if(player.pin !== pin){
          reject({
            message: `PIN doesn't match`
          });
        }
        else {
          resolve(player);
        }
      }
    })
  }

  getPiecesAroundPoint(x, y){
    const x_low    = x - 1;
    const x_high = x + 1;
    let   y_low  = y - 1;
    const y_high = y + 1;

    let return_grid = [];

    let cur = 0;
    while(y_low <= y_high){
      let x_c = x_low;
      return_grid[cur] = [];
      while(x_c <= x_high){
        let piece_data = this.pieces_hash[`${x_c}_${y_low}`];
        if(!piece_data){
          return_grid[cur].push(null);
        }
        else {
          return_grid[cur].push(piece_data.piece);
        }
        x_c++;
      }
      y_low++;
      cur++;
    }

    return return_grid;
  }

  tileOccupied(x, y){
    const piece_data = this.pieces_hash[`${x}_${y}`];
    if(!piece_data){
      return false;
    }
    return true;
  }

  tileActive(x, y){
    return x < this.current_size && y < this.current_size;
  }

  removePiece(piece_id){
    for(let k in this.pieces_hash){
      let piece_data = this.pieces_hash[k];
      if(piece_data.piece._id === piece_id){
        this.io.sockets.emit('remove_piece', piece_id);
        delete this.pieces_hash[k];
        break;
      }
    }
  }

  playerBuild(player, constructor, x, y){

    // check that tile is an actual tile in the world
    if(!this.tileActive(x, y)){
      throw new Error(`That tile (${x}, ${y}) is not active<br/>  There must be no where to build before the grid is expanded<br/>  Your script has stopped`);
    }

    // check if tile already has a piece or not
    if(this.tileOccupied(x, y)){
      throw new Error(`That tile (${x}, ${y}) is occupied<br/>  Your script has stopped`);
    }

    // check if turn data allows building the piece
    let can_build = this.playerCanBuildThisTurn(player, constructor);
    // expect can_build to be true or a String with an error message
    if(can_build !== true){
      throw new Error(can_build);
    }

    // check that piece is buildable at desired location
    can_build = this.pieceCanBuildThere(player, constructor, x, y);
    // expect can_build to be true or a String with an error message
    if(can_build !== true){
      throw new Error(can_build);
    }

    let piece = new constructor();
    this.pieces_hash[`${x}_${y}`] = {
      health: 100,
      piece:  piece,
      player: player
    };
    this.io.sockets.emit('new_piece', piece.getState());

    this.addPieceBuildToTurnData(this.pieces_hash[`${x}_${y}`]);

    return piece;
  }

  playerCanBuildThisTurn(player, constructor){
    if(constructor.getType() === 'Warrior'){
      const max_warrior_builds = this.players_turn_data[player._id].home_count * 4;
      if(max_warrior_builds <= this.players_turn_data[player._id].warrior_builds){
        return `You cannot build a warrior<br/>  You may only build 4 warriors per home you have before the turn`;
      }
    }
    else if(constructor.getType() === 'Home'){
      const max_home_builds = 1;
      if(max_home_builds <= this.players_turn_data[player._id].home_builds){
        return `You cannot build a home<br/>  You may only build 1 home per turn`;
      }
    }

    return true;
  }

  pieceCanBuildThere(player, constructor, x, y){
    if(constructor.getType() === 'Warrior'){
      let shares_border_with_home = false;
      // warrior must be built next to home
      for(let home of player.homes){
        if(Game.shareBorder(home.x, home.y, x, y)){
          shares_border_with_home = true;
          break;
        }
      }
      return shares_border_with_home ? true : `Warrior can only be built on a tile bordering a home<br/>  ${x}, ${y} is not a home-bordering tile`;
    }

    return true;
  }

  addPieceBuildToTurnData(piece_data){
    this.players_turn_data[piece_data.player._id][`${piece_data.piece.type.toLowerCase()}_builds`]++;
  }

  handlePlayerMove(player, piece, new_x, new_y){
    if(this.tileOccupied(new_x, new_y)){
      throw new Error(`That tile (${new_x}, ${new_y}) is occupied. Your script has stopped. <br/>Make sure to check <em>piece.world</em> to see what is around your piece`);
    }

    let piece_data = this.findPieceDataWithXY(piece._id);

    if(piece_data.player._id !== player._id){
      throw new Error(`That piece (${new_x}, ${new_y}) is not yours. Your script has stopped`);
    }

    let old_x = piece_data.x;
    let old_y = piece_data.y;

    let x_dist = Math.abs(new_x - old_x);
    let y_dist = Math.abs(new_y - old_y);

    if(x_dist > 0 && y_dist > 0){
      throw new Error(`That piece (${new_x}, ${new_y}) can only move in one direction at a time`);
    }
    if(x_dist > 1 || y_dist > 1){
      throw new Error(`That piece (${new_x}, ${new_y}) can only move one tile at a time`);
    }

    delete piece_data.x;
    delete piece_data.y;

    const new_direction = Game.getDirection(old_x, old_y, new_x, new_y);
    if(!isNaN(new_direction)){
      piece_data.direction = new_direction;
    }

    this.pieces_hash[`${new_x}_${new_y}`] = piece_data;

    delete this.pieces_hash[`${old_x}_${old_y}`];

    this.send('piece_direction', piece_data.piece._id, piece_data.direction);
    this.send('move_piece',      piece_data.piece._id, new_x, new_y);

    // adding such long sleep so that movement can be seen
    // and the piece doesn't just appear to be teleporting
    sleep.msleep(100);

  }

  findPieceData(piece_id){
    for(let k in this.pieces_hash){
      let piece_data = this.pieces_hash[k];
      if(piece_data.piece._id === piece_id){
        return piece_data;
      }
    }
    return null;
  }
  findPieceDataWithXY(piece_id){
    for(let k in this.pieces_hash){
      let piece_data = this.pieces_hash[k];
      if(piece_data.piece._id === piece_id){
        let x_y_split = k.split(/_/i);
        let x = parseInt(x_y_split[0]);
        let y = parseInt(x_y_split[1]);
        return Object.assign(piece_data, {x: x, y: y});
      }
    }
    return null;
  }

  handlePlayerAttack(player, attacker, attackee, damage){

    let attacker_data = this.findPieceData(attacker._id);
    let attackee_data = this.findPieceData(attackee._id);

    if(!attacker.attackable){
      throw new Error(`This piece (${attacker.x}, ${attacker.y}) cannot attack. Script terminated`);
    }
    let can_attack = false;
    if(attacker.x === attackee.x){
      if(attacker.y + 1 === attackee.y || attacker.y - 1 === attackee.y){
        can_attack = true;
      }
    }
    else if(attacker.y === attackee.y){
      if(attacker.x + 1 === attackee.x || attacker.x - 1 === attackee.x){
        can_attack = true;
      }
    }
    if(can_attack){
      const new_direction = Game.getDirection(attacker.x, attacker.y, attackee.x, attackee.y);
      if(!isNaN(new_direction)){
        attacker_data.direction = new_direction;
      }
      this.send('piece_direction', attacker._id, attacker.direction);
      this.send('piece_animation', attacker._id, 'attacking');
      for(var i = 0; i < damage; i++){
        this.pieces_hash[`${attackee.x}_${attackee.y}`].health += -1;

        if(attackee.health <= 0){
          this.removePiece(attackee._id);
        }

        sleep.msleep(50);
      }
    }
    else {
      attacker_data.player.log(`You tried to attack nothing<br/>  script sleeping`, 'info');
      sleep.msleep(damage * 1);
    }
    this.send('piece_animation', attacker._id, 'idle');
  }

  handlePlayerHeal(player, piece, amount){
    let piece_data = this.findPieceData(piece._id);
    if(player._id !== piece_data.player._id){
      player.log(`Healing at 3x the normal rate because you are helping another :')`, 'success');
    }
    for(let i = 0; i < amount; i++){
      this.pieces_hash[`${piece.x}_${piece.y}`].health += 1;

      if(player._id !== piece_data.player._id){
        sleep.msleep(25);
      }
      else {
        sleep.msleep(75);
      }
    }
  }



  send(){
    let args = [...arguments];
    this.io.sockets.emit.apply(this.io.sockets, args);
  }

  sendUpdatePiece(piece){
    this.io.sockets.emit('update_piece', piece.getState());
  }

  sendUpdatePieceKey(piece, key, value){
    this.io.sockets.emit('update_piece_key', piece._id, key, value);
  }

  setPlayerCode(player_id, code){
    return this.findPlayer(player_id).then(player => {
      player.code = code;
      return true;
    })
  }

  findPlayer(player_id){
    return new Promise((resolve, reject) => {
      for(let p of this.players){
        if(p._id === player_id){
          return resolve(p);
        }
      }
      return reject();
    })
  }

  findPlayerByName(name){
    for(let p of this.players){
      if(p.name === name){
        return p;
      }
    }
    return null;
  }

  sendGameStateToSockets(){
    if(!this.io){
      return;
    }
    this.io.sockets.emit('game_state', this.getState());
  }

  static shareBorder(x1, y1, x2, y2){
    if(x1 === x2){
      if(y1 + 1 === y2 || y1 - 1 === y2){
        return true;
      }
    }
    else if(y1 === y2){
      if(x1 + 1 === x2 || x1 - 1 === x2){
        return true;
      }
    }
    return false;
  }
  /**
   * Gets new direction based on old and new coords
   * If no difference, returns null
   */
  static getDirection(old_x, old_y, new_x, new_y){
    if(old_x !== new_x){
      return (new_x > old_x) ? 90 : 270;
    }
    else if(old_y !== new_y){
      return (new_y > old_y) ? 180 : 0;
    }
    return null;
  }
}

exports = module.exports = Game;
