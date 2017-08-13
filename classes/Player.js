'use strict';


const safeEval = require('safe-eval');
const util     = require('util');
const uuid     = require('uuid/v4');

// array of fields we want to make sure the user doesn't change in their code

let map           =  new WeakMap();

exports = module.exports = game => {
  const Home     = require('./Piece-Home')(game);
  const Warrior  = require('./Piece-Warrior')(game);


  class Player {
    constructor(name, pin){

      map.set(this, {
        _id:    uuid(),
        name:   name,
        active: true,
        pin:    pin,
        code:   ''
      });

      const private_keys = [
        'getState',
        'build',
        'init',
        'log'
      ];
      try {
        for(let key of private_keys){
          Object.defineProperty(this, key, {
            value:    this[key].bind(this),
            writable: false
          })
        }
      }
      catch(e){
        console.log(e);
      }
    }

    // private get/sets
    get _id(){    return map.get(this)._id; }
    get name(){   return map.get(this).name; }
    get pin(){    return map.get(this).pin; }
    get sockets(){
      return game.players_sockets[this._id];
    }
    get pieces(){
      return game.pieces
        .filter(p => p.player._id === this._id);
    }
    get homes(){
      return game.pieces
        .filter(p => (p.player._id === this._id && p.type === 'Home'));
    }
    get warriors(){
      return game.pieces
        .filter(p => (p.player._id === this._id && p.type === 'Warrior'));
    }
    get code(){   return map.get(this).code; }

    set code(value){
      map.get(this).code = value;

      this.send('update_code', value);
    }

    //--- private get/sets

    getState(){
      return {
        _id:    this._id,
        name:   this.name
      }
    }

    build(constructor, x, y){
      return game.playerBuild(this, constructor, x, y);
    }

    init(){
      return new Promise((resolve, reject) => {
        resolve(this);
      })
    }

    log(content, type){
      try {
        if(typeof content === 'object'){
          content = JSON.stringify(util.inspect(content));
          // removes outer quotes
          content = content.substring(1, content.length-1);
        }
      }
      catch(e){
        content = JSON.stringify(util.inspect(e));
        // removes outer quotes
        content = content.substring(1, content.length-1);
      }
      for(let socket of this.sockets){
        socket.emit('log', content, type);
      }

    }

    send(){
      let args = [...arguments];
      for(let socket of this.sockets){
        socket.emit.apply(socket, args);
      }
    }

    evalCode(){

      try {
        safeEval( `(()=>{
          'use strict';
          ${this.code}
        })();`, {
          console: console,
          player:  this,
          Home:    Home,
          Warrior: Warrior,
          log:     this.log.bind(this),
          util:    util
        }, {
          timeout: game.EVAL_CODE_TIMEOUT_MS
        });
      }
      catch(e){
        if(/Script execution timed out\./i.test(e.message)){
          console.log('code takes too long');
          this.log(`code didn't finish running`, 'error');
          this.log(`  => your code only has ${game.EVAL_CODE_TIMEOUT_MS}ms to execute`, 'error');
          this.log(`
  <strong>setting the health of or attacking a piece?</strong>
  <code>
  the <a target='_blank' href='https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty'>setter</a> for some actions force a for loop so if you are trying
  to boost your health too much or move to every spot on the board in one turn
  it will use all of your execution time
  </code>
            `, 'info');
        }
        else {
          console.log(e);
          this.log(e, 'error');
        }
      }
    }
  }

  return Player;
};
