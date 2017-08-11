'use strict';

const express = require('express');
const router  = express.Router();
const Game    = require('../classes/Game');

const game = new Game();

/* GET home page. */
router.get('/game_state', (req, res, next) => {
  res.jsonp(game.getState());
});

router.post('/add_player', (req, res, next) => {
  const name = req.body.name;

  game.addPlayer(name).then(player => {
    resolveWithMeta({
      player:  player.getState(),
      game:    game.getState()
    }, res);
  }).catch(err => {
    rejectWithMeta({
      message: err.message,
      err:     err
    }, res);
  })
});

router.post('/set_code', (req, res, next) => {
  const code      = req.body.code;
  const player_id = req.body.player_id;

  game.setPlayerCode(player_id, code).then(success => {
    resolveWithMeta({}, res);
  }).catch(err => {
    rejectWithMeta({
      message: err.message,
      err:     err
    }, res);
  })
});

module.exports = _io => {
  game.setIo(_io);
  return router;
};


let rejectWithMeta = (body, res) => {
  body.success = false;
  body.meta    = responseMeta();

  res.jsonp(body);
}

let resolveWithMeta = (body, res) => {
  body.success = true;
  body.meta    = responseMeta();

  res.jsonp(body);
}

let responseMeta = () => {
  return {
    timestamp: Date.now()
  }
}
