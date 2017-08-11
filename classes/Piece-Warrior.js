'use strict';


exports = module.exports = game => {

  let map           =  new WeakMap();

  const Piece = require('./Piece')(game);

  class Warrior extends Piece {
    constructor(player, x, y){
      super(player, x, y);

      this.color = 'red';

      map.set(this, {
        type:       'Warrior',
        movable:    true,
        attackable: true,
        power:      5
      });
    }
    get type(){       return map.get(this).type; }
    get movable(){    return map.get(this).movable; }
    get attackable(){ return map.get(this).attackable; }
    get power(){      return map.get(this).power; }
  }

  return Warrior;
};
