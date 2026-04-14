const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'games.log');

// Ensure logs directory exists on first use
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function write(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
  fs.appendFile(LOG_FILE, line, err => {
    if (err) console.error('[logger] Failed to write log:', err.message);
  });
}

/**
 * Log the start of a game.
 * @param {object} room
 */
function logGameStart(room) {
  write({
    type:    'game_start',
    room:    room.code,
    mode:    room.gameMode,
    target:  room.targetScore,
    players: room.players.map(p => p.name),
  });
}

/**
 * Log the end of a game.
 * @param {object} room
 */
function logGameEnd(room) {
  write({
    type:   'game_end',
    room:   room.code,
    mode:   room.gameMode,
    winner: room.winner,
    rounds: room.handHistory?.length ?? 0,
    scores: [...room.players]
      .sort((a, b) => b.score - a.score)
      .map(p => ({ name: p.name, score: p.score })),
  });
}

/**
 * Log a game abandoned mid-play (all players disconnected).
 * @param {object} room
 */
function logGameAbandoned(room) {
  write({
    type:         'game_abandoned',
    room:         room.code,
    mode:         room.gameMode,
    status:       room.status,           // 'bidding' or 'playing'
    handsPlayed:  room.handHistory?.length ?? 0,
    players:      room.players.map(p => ({ name: p.name, score: p.score })),
  });
}

module.exports = { logGameStart, logGameEnd, logGameAbandoned };
