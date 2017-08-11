'use strict';

const logger = require('morgan');


class Game {
  constructor(){
    this.players = [];
    this.pieces  = [];

    // create an initial grid of 10x10
    const grid_size = 10;
    this.pieces_grid = new Array(grid_size);
    for(var i = 0, l = this.pieces_grid.length; i < l; i++){
      this.pieces_grid[i] = new Array(grid_size);
    }

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

    this.EVAL_CODE_TIMEOUT_MS = 200;

    this.MAX_PLAYERS = this.ALOTTED_EVAL_MS / this.EVAL_CODE_TIMEOUT_MS;

    this.start();
  }

  setIo(io){
    this.io = io;
    this.addIoListeners();
  }

  addIoListeners(){
    this.io.on('connection', socket => {

      socket.emit('game_state', this.getState());

      socket.on('join_game', player_id => {
        this.findPlayer(player_id).then(player => {
          player.socket = socket;
          player.log(`Welcome, ${player.name}`);
        })
      });

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

  clearInEvalsInterval(){
    // console.log('clearInEvalsInterval');
    if(this.in_evals_update_interval){
      clearInterval(this.in_evals_update_interval);
    }
  }

  cleanupAfterEvalsRound(){
    // console.log('cleanupAfterEvalsRound');
    if(this.in_evals_update_interval){
      clearInterval(this.in_evals_update_interval);
    }
    // this.count = 0;
    this.eval_game_states = [];
    this.sendGameStateToSockets();
  }

  update(){
    const num_players = this.players.length;

    // eval players code
    if(this._time % this.EVAL_INTERVAL_MS === 0 && num_players > 0){
      // console.log('\n\n');
      const update_interval = this.ALOTTED_EVAL_MS / num_players;
      // console.log('RUN EVALS', update_interval);
      // clear the interval if exists
      this.clearInEvalsInterval();
      // start interval to send game state evenly spaced for players in game
      this.in_evals_update_interval = setInterval(this.shiftAndSendGameStateToSockets.bind(this), update_interval);
      // set timeout to clear the interval after all code has been evald
      this.in_eval_update_timeout   = setTimeout(this.cleanupAfterEvalsRound.bind(this), this.ALOTTED_EVAL_MS + 1);

      // go through players randomly and evalCode
      for(let p of this.getPlayerOrder()){
        // eval the player code
        p.evalCode();
        // push onto game state to build a sort of history
        this.eval_game_states.push(this.getState());
      }
      // console.log('EVALS OVER');
    }
    else {
      this.sendGameStateToSockets();
    }

    this._time += this.UPDATE_INTERVAL_MS;
  }

  addPlayer(name){
    return new Promise((resolve, reject) => {
      this.canAddPlayerWithName(name).then(can => {

        if(can.add === true){

          let player = new this.Player(name);

          player.init().then(player => {
            this.players.push(player);
            resolve(player);
          })

        }
        else {
          reject({
            message: can.message
          })
        }

      })
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
        return_grid[cur].push(this.pieces_grid[x_low][y_c]);
        y_c++;
      }
      x_low++;
      cur++;
    }

    return return_grid;
  }

  _playerBuild(player, constructor, x, y){
    let piece = new constructor(player, x, y);
    this.pieces.push(piece);
    this.pieces_grid[x][y] = piece;
    return piece;
  }

  canAddPlayerWithName(name){
    var can = {
      add:     true,
      message: null
    };
    return new Promise((resolve, reject) => {
      for(let p of this.players){
        if(p.name === name){
          can.add     = false;
          can.message = 'Player with name already exists';
          break;
        }
      }
      resolve(can);
    })
  }

  setPlayerCode(player_id, code){
    return this.findPlayer(player_id).then(player => {
      return player.setCode(code).then(player => {
        return true;
      })
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

  shiftAndSendGameStateToSockets(){
    // console.log('shiftAndSendGameStateToSockets', ++this.count);
    if(!this.io){
      return;
    }
    if(this.eval_game_states.length > 0){
      this.io.sockets.emit('game_state', this.eval_game_states.shift());
    }
    else {
      this.io.sockets.emit('game_state', this.getState());
    }
  }
  sendGameStateToSockets(){
    if(!this.io){
      return;
    }
    this.io.sockets.emit('game_state', this.getState());
  }
}

exports = module.exports = Game;
