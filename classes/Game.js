'use strict';

const sleep = require('sleep');

class Game {
  constructor(){
    this.players = [];

    this.players_sockets = {};

    this.players_turn_data = {};

    Object.defineProperty(this, 'pieces', {
      writable:   true,
      enumerable: true,
      value:      []
    })

    // create an initial grid of 10x10
    const grid_size = 10;
    let pieces_grid = new Array(grid_size);
    for(var i = 0, l = pieces_grid.length; i < l; i++){
      pieces_grid[i] = new Array(grid_size);
      for(var i2 = 0, l2 = pieces_grid[i].length; i2 < l2; i2++){
        pieces_grid[i][i2] = null;
      }
    }
    Object.defineProperty(this, 'pieces_grid', {
      writable:   true,
      enumerable: true,
      value:      pieces_grid
    })


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
      pieces:  this.pieces.map(p => p.getState())
    }
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

  getPiecesAroundPoint(player, x, y){
    let x_low    = x - 1;
    const x_high = x + 1;
    const y_low  = y - 1;
    const y_high = y + 1;

    let return_grid = [];

    let cur = 0;
    while(x_low <= x_high){
      let y_c = y_low;
      return_grid[cur] = [];
      while(y_c <= y_high){
        let row = this.pieces_grid[x_low];
        if(!row){
          return_grid[cur].push(undefined);
        }
        else {
          return_grid[cur].push(row[y_c]);
        }
        y_c++;
      }
      x_low++;
      cur++;
    }

    return return_grid;
  }

  tileOccupied(x, y){
    const row = this.pieces_grid[x];
    if(row){
      return row[y] !== null;
    }
    return false;
  }

  tileActive(x, y){
    const row = this.pieces_grid[x];
    if(!row){
      return false;
    }
    return (row[y] !== void 0);
  }

  removePiece(piece_id){
    for(let i = 0, l = this.pieces.length; i < l; i++){
      if(this.pieces[i]._id === piece_id){
        this.io.sockets.emit('remove_piece', this.pieces[i].getState());
        this.pieces_grid[this.pieces[i].x][this.pieces[i].y] = null;
        this.pieces.splice(i, 1);
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

    let piece = new constructor(player, x, y);
    this.io.sockets.emit('new_piece', piece.getState());
    this.pieces.push(piece);
    this.pieces_grid[x][y] = piece;

    this.addPieceBuildToTurnData(piece);

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

  addPieceBuildToTurnData(piece){
    this.players_turn_data[piece.player._id][`${piece.type.toLowerCase()}_builds`]++;
  }

  movePiece(old_x, old_y, new_x, new_y){
    if(this.tileOccupied(new_x, new_y)){
      throw new Error(`That tile (${new_x}, ${new_y}) is occupied. Your script has stopped. <br/>Make sure to check <em>piece.world</em> to see what is around your piece`);
    }

    const piece = this.pieces_grid[old_x][old_y];

    this.pieces_grid[old_x][old_y] = null;

    this.pieces_grid[new_x][new_y] = piece;

    let direction = 0;
    if(old_x !== new_x){
      direction = (new_x > old_x) ? 90 : 270;
    }
    else {
      direction = (new_y > old_y) ? 180 : 0;
    }
    this.send('piece_direction', piece._id, direction);
    this.send('move_piece',      piece.getState(), new_x, new_y);

    // adding such long sleep so that movement can be seen
    // and the piece doesn't just appear to be teleporting
    sleep.msleep(100);

  }

  handleAttack(attacker, attackee, damage){
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
      this.send('piece_animation', attacker._id, 'attacking');
      for(var i = 0; i < damage; i++){
        attackee.health += -1;
        sleep.msleep(50);
      }
    }
    else {
      attacker.player.log(`You tried to attack nothing<br/>  script sleeping`, 'info');
      sleep.msleep(damage * 1);
    }
    this.send('piece_animation', attacker._id, 'idle');
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

  findPlayerByName(name){
    for(let p of this.players){
      if(p.name === name){
        return p;
      }
    }
    return null;
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
  removePlayerData(player_id){
    for(var i = this.pieces.length - 1; i >= 0; i += -1){
      if(this.pieces[i].player._id === player_id){
        this.pieces.splice(i, 1);
      }
    }
  }
  sendGameStateToSockets(){
    if(!this.io){
      return;
    }
    const game_state = this.getState();
    // console.log(game_state);
    // console.log(this.pieces_grid);
    this.io.sockets.emit('game_state', game_state);
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
}

exports = module.exports = Game;
