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
      });

    }

    get _id(){     return map.get(this)._id; }
    get player(){  return map.get(this).player; }
    get health(){  return map.get(this).health; }
    get x(){       return map.get(this).x; }
    get y(){       return map.get(this).y; }

    get world() {
      return game.getPiecesAroundPoint(this.player, this.x, this.y);
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
        map.get(this).x += direction;
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
        map.get(this).y += direction;
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

    heal( points ){
      for(var i = 0; i < points; i++){
        this.health += points;
      }
    }
  }

  return Piece;

};
