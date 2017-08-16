'use strict';

const uuid  = require('uuid/v4');

exports = module.exports = game => {

  let map = new WeakMap();

  class Piece {
    constructor(){

      map.set(this, {
        _id:     uuid(),
        color:   'blue'
      });

    }

    get _id(){     return map.get(this)._id; }
    get color(){   return map.get(this).color; }

    // managed by game
    get health(){
      let piece_data = game.findPieceData(this._id);

      if(!piece_data){
        return -1;
      }

      return piece_data.health;
    }
    get direction(){
      let piece_data = game.findPieceData(this._id);

      if(!piece_data){
        return 0;
      }

      return piece_data.direction;
    }
    get x(){
      let piece_data = game.findPieceDataWithXY(this._id);

      if(!piece_data){
        return -1;
      }

      return piece_data.x;
    }
    get y(){
      let piece_data = game.findPieceDataWithXY(this._id);

      if(!piece_data){
        return -1;
      }

      return piece_data.y;
    }
    get active(){
      let piece_data = game.findPieceData(this._id);

      if(!piece_data){
        return false;
      }

      return piece_data.health > 0;
    }
    get world(){
      return game.getPiecesAroundPoint(this.x, this.y);
    }

    set color(value){
      if(!this.active){
        throw new Error(`Piece (${this.x}, ${this.y}) is inactive (health < 0). So you can't color it..`);
      }

      map.get(this).color = value;

      if(this.constructed){
        game.sendUpdatePieceKey(this, 'color', value);
      }
    }

    getState(){
      return {
        _id:        this._id,
        type:       this.type,
        color:      this.color,
        movable:    this.movable,
        attackable: this.attackable,
        x:          this.x,
        y:          this.y,
        direction:  this.direction,
        health:     this.health,
      }
    }
  }

  return Piece;

};
