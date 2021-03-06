'use strict';


exports = module.exports = game => {

  let map           =  new WeakMap();

  const Piece = require('./Piece')(game);

  class Home extends Piece {
    constructor(player, x, y){
      super(player, x, y);

      map.set(this, {
        type:       'Home',
        movable:    false,
        attackable: false
      });


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
      return 'Home';
    }
  }

  return Home;
};
