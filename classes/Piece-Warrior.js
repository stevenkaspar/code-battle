'use strict';


exports = module.exports = game => {

  let map           =  new WeakMap();

  const Piece = require('./Piece')(game);

  class Warrior extends Piece {
    constructor(player, x, y){
      super(player, x, y);

      map.set(this, {
        type:       'Warrior',
        movable:    true,
        attackable: true
      });

      this.color = 'red';

      Object.defineProperty(this, 'constructed', {
        value:      true,
        writable:   false,
        enumerable: false
      })
    }
    get type(){       return map.get(this).type; }
    get movable(){
      return map.get(this).movable && this.active;
    }
    get attackable(){
      return map.get(this).attackable && this.active;
    }

    static getType(){
      return 'Warrior';
    }
  }

  return Warrior;
};
