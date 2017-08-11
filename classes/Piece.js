'use strict';

const uuid = require('uuid/v4');

exports = module.exports = game => {

  let map = new WeakMap();

  class Piece {
    constructor(player, x, y){

      this.color  = 'blue';

      map.set(this, {
        _id:     uuid(),
        player:  player,
        health:  100,
        x:       x,
        y:       y,
        active:  true
      });

      const private_keys = [
        'attack'
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

    get _id(){     return map.get(this)._id; }
    get player(){  return map.get(this).player; }
    get health(){  return map.get(this).health; }
    get x(){       return map.get(this).x; }
    get y(){       return map.get(this).y; }
    get active(){  return map.get(this).active; }

    get world() {
      return game.getPiecesAroundPoint(this.player, this.x, this.y);
    }

    set active(value){
      if(!this.active){
        throw new Error(`You cannot set the active state after it has been set to false (${this.x}, ${this.y})`)
      }
      map.get(this).active = value;
    }

    set health(value){
      const starting_value = this.health;
      const diff           = value - starting_value;
      // force to be 1, 0, or -1
      const direction = diff > 0 ? 1 : (diff === 0 ? 0 : -1);
      // loop is used because code will be limited to
      // execution time
      for(var i = 0; i < Math.abs(diff); i++){
        map.get(this).health += direction;

        if(map.get(this).health === 0){
          game.removePiece(this._id);
          this.active = false;
        }
        // else if(map.get(this).health < 0){
        //   console.log('Damaging beyond 0. Could possibly throw error');
        // }
      }
    }

    set x(value){
      if(!this.movable){
        throw new Error(`${this.type} piece is not movable`);
      }
      const starting_value = this.x;
      const diff           = value - starting_value;
      // force to be 1, 0, or -1
      const direction = diff > 0 ? 1 : (diff === 0 ? 0 : -1);
      // loop is used because code will be limited to
      // execution time
      for(var i = 0; i < Math.abs(diff); i++){
        let next_val = map.get(this).x + direction;

        game.movePiece(this.x, this.y, next_val, this.y);

        map.get(this).x = next_val;
      }
    }

    set y(value){
      if(!this.movable){
        throw new Error(`${this.type} piece is not movable`);
      }
      const starting_value = this.y;
      const diff           = value - starting_value;
      // force to be 1, 0, or -1
      const direction = diff > 0 ? 1 : (diff === 0 ? 0 : -1);
      // loop is used because code will be limited to
      // execution time
      for(var i = 0; i < Math.abs(diff); i++){
        let next_val = map.get(this).y + direction;

        game.movePiece(this.x, this.y, this.x, next_val);

        map.get(this).y = next_val;
      }
    }

    getState(){
      return {
        _id:        this._id,
        x:          this.x,
        y:          this.y,
        type:       this.type,
        color:      this.color,
        active:     this.active,
        health:     this.health,
        movable:    this.movable,
        attackable: this.attackable,
        player:     this.player.getState()
      }
    }

    attack(attackee, damage){
      if(!this.attackable){
        throw new Error(`This piece (${this.x}, ${this.y}) cannot attack. Script terminated`);
      }
      let can_attack = false;
      if(this.x === attackee.x){
        if(this.y + 1 === attackee.y || this.y - 1 === attackee.y){
          can_attack = true;
        }
      }
      else if(this.y === attackee.y){
        if(this.x + 1 === attackee.x || this.x - 1 === attackee.x){
          can_attack = true;
        }
      }

      if(can_attack){
        attackee.health += -damage;
      }
      else {
        var i = 0;
        while(i < Math.abs(damage * 2)){
          // waste time of attacker
          i++;
        }
        this.player.log(`You tried to attack nothing. This is a <em>damage x 2</em> execution time penalty`, 'info');
      }
    }

    heal( points ){
      for(var i = 0; i < points; i++){
        this.health += points;
      }
    }
  }

  return Piece;

};
