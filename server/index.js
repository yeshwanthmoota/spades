const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const {
  dealCards,
  dealExactCards,
  validatePlay,
  determineTrickWinner,
  calculateScore,
  calculateGullyScore,
  getGullyCardsForRound,
  getGullyTotalRounds,
  botBid,
  botPlayCard,
  botGullyBid,
} = require('./gameLogic');
const {
  createRoom,
  joinRoom,
  removePlayer,
  getRoom,
  getRoomBySocketId,
  clearSocketMapping,
  updateSocketId,
} = require('./roomManager');
const { logGameStart, logGameEnd, logGameAbandoned } = require('./logger');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// Serve React build
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip internal fields (credentials, timers) and opponent hands from the view */
function roomView(room, requestingSocketId) {
  // trickTimer is a Node.js Timeout object — not JSON-serialisable, must exclude
  const { credentials, botTimers, trickTimer, ...roomData } = room;
  return {
    ...roomData,
    players: room.players.map(p => ({
      ...p,
      hand: p.socketId === requestingSocketId ? p.hand : p.hand.map(() => ({ hidden: true })),
    })),
  };
}

function broadcast(room) {
  for (const player of room.players) {
    const sock = io.sockets.sockets.get(player.socketId);
    if (sock) sock.emit('game_update', roomView(room, player.socketId));
  }
  scheduleBot(room); // trigger bot if active player is disconnected
}

function broadcastLobby(room) {
  for (const player of room.players) {
    const sock = io.sockets.sockets.get(player.socketId);
    if (sock) sock.emit('room_update', roomView(room, player.socketId));
  }
}

function nextPlayerIndex(room, currentIndex) {
  return (currentIndex + 1) % room.players.length;
}

function startBiddingPhase(room) {
  room.status = 'bidding';
  const firstBidderIndex = nextPlayerIndex(room, room.dealerIndex);
  room.currentTurn = room.players[firstBidderIndex].socketId;
  room.players.forEach(p => { p.bid = null; p.tricksWon = 0; });
  console.log(`[${room.code}] Bidding started. First bidder: ${room.currentTurn}`);
  broadcast(room);
}

function allBidsSubmitted(room) {
  return room.players.every(p => p.bid !== null);
}

function startPlayingPhase(room) {
  room.status = 'playing';
  room.currentTrick = [];
  room.leadSuit = null;
  room.trickHistory = [];
  const firstLeaderIndex = nextPlayerIndex(room, room.dealerIndex);
  room.currentTurn = room.players[firstLeaderIndex].socketId;
  console.log(`[${room.code}] Playing started. First lead: ${room.currentTurn}`);
  broadcast(room);
}

function advanceTurn(room) {
  const idx = room.players.findIndex(p => p.socketId === room.currentTurn);
  room.currentTurn = room.players[nextPlayerIndex(room, idx)].socketId;
}

function checkHandComplete(room) {
  return room.players.every(p => p.hand.length === 0);
}

function wipeCredentials(room) {
  room.credentials = {};
  console.log(`[${room.code}] Credentials wiped`);
}

// Called after the 10-second trick_complete pause when the hand is over.
// Scores the round and immediately starts the next one (no extra delay).
function resolveHand(room) {
  const isGully = room.gameMode === 'gully';

  for (const player of room.players) {
    const earned = isGully
      ? calculateGullyScore(player.bid, player.tricksWon)
      : calculateScore(player.bid, player.tricksWon);
    player.score += earned;
    console.log(`[${room.code}] ${player.name}: bid=${player.bid} won=${player.tricksWon} earned=${earned} total=${player.score}`);
  }

  room.handHistory.push(
    room.players.map(p => ({ name: p.name, bid: p.bid, tricksWon: p.tricksWon, score: p.score }))
  );

  const maxScore   = Math.max(...room.players.map(p => p.score));
  const totalRounds = isGully ? getGullyTotalRounds(room.players.length) : Infinity;
  let gameOver = false;

  if (isGully) {
    const allRoundsDone = room.roundNumber >= totalRounds;
    const targetHit     = room.targetScore !== null && maxScore >= room.targetScore;
    if (allRoundsDone || targetHit) {
      const leaders = room.players.filter(p => p.score === maxScore);
      room.status = 'finished';
      room.winner  = leaders[0].name;
      room.rematchVotes = [];
      gameOver = true;
      wipeCredentials(room);
      console.log(`[${room.code}] Gully game over! Winner: ${room.winner} (round ${room.roundNumber}/${totalRounds})`);
      logGameEnd(room);
    }
  } else {
    if (room.targetScore !== null && maxScore >= room.targetScore) {
      const leaders = room.players.filter(p => p.score === maxScore);
      if (leaders.length === 1) {
        room.status = 'finished';
        room.winner  = leaders[0].name;
        room.rematchVotes = [];
        gameOver = true;
        wipeCredentials(room);
        console.log(`[${room.code}] Game over! Winner: ${room.winner}`);
        logGameEnd(room);
      } else {
        console.log(`[${room.code}] Tie — playing another round`);
      }
    }
  }

  if (!gameOver) {
    // Immediately start next round — the 10-second pause was already served by completeTrick
    room.dealerIndex = nextPlayerIndex(room, room.dealerIndex);
    room.roundNumber += 1;
    const hands = isGully
      ? dealExactCards(room.players.length, getGullyCardsForRound(room.roundNumber, room.players.length))
      : dealCards(room.players.length);
    room.players.forEach((p, i) => { p.hand = hands[i]; p.bid = null; p.tricksWon = 0; });
    room.spadesBroken = false;
    startBiddingPhase(room);
  } else {
    broadcast(room);
  }
}

// ─── Unified trick completion ─────────────────────────────────────────────────
// Called whenever all N players have played. Sets trick_complete, broadcasts the
// full trick, then after 10 s resolves the trick (and optionally the hand).
function completeTrick(room) {
  const isLastTrick = checkHandComplete(room); // hands already stripped of played card
  const winnerId    = determineTrickWinner(room.currentTrick);

  // Set status and broadcast — currentTrick still has all N cards
  room.status = 'trick_complete';
  broadcast(room);

  // Cancel any stale timer (safety)
  if (room.trickTimer) clearTimeout(room.trickTimer);

  room.trickTimer = setTimeout(() => {
    room.trickTimer = null;
    if (!require('./roomManager').rooms[room.code]) return; // room was deleted

    // Now resolve the trick
    const winner = room.players.find(p => p.socketId === winnerId);
    if (winner) winner.tricksWon += 1;
    room.trickHistory.push([...room.currentTrick]);
    room.currentTrick = [];
    room.leadSuit     = null;
    room.currentTurn  = winnerId;
    room.status       = 'playing';

    if (isLastTrick) {
      resolveHand(room); // score + deal next round immediately
    } else {
      broadcast(room);   // next trick begins
    }
  }, 5000);
}

// ─── Bot scheduling ───────────────────────────────────────────────────────────

function scheduleBot(room) {
  if (room.status !== 'bidding' && room.status !== 'playing') return;

  const current = room.players.find(p => p.socketId === room.currentTurn);
  if (!current || !current.disconnected) return;

  const name = current.name;
  if (room.botTimers[name]) return; // already pending

  console.log(`[bot] Scheduling move for disconnected player: ${name}`);

  room.botTimers[name] = setTimeout(() => {
    delete room.botTimers[name];

    // Re-validate — state may have changed (player reconnected, etc.)
    const player = room.players.find(p => p.name === name);
    if (!player || !player.disconnected || room.currentTurn !== player.socketId) return;

    if (room.status === 'bidding') {
      let bid;
      if (room.gameMode === 'gully') {
        const submittedBids = room.players.filter(p => p.bid !== null).map(p => p.bid);
        bid = botGullyBid(player.hand, submittedBids, room.players.length);
      } else {
        bid = botBid(player.hand);
      }
      player.bid = bid;
      console.log(`[bot] ${name} bids ${player.bid}`);
      if (allBidsSubmitted(room)) startPlayingPhase(room);
      else { advanceTurn(room); broadcast(room); }

    } else if (room.status === 'playing') {
      const card = botPlayCard(player.hand, room.leadSuit, room.spadesBroken);
      if (!card) return;

      player.hand = player.hand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
      if (room.currentTrick.length === 0) room.leadSuit = card.suit;
      room.currentTrick.push({ playerId: player.socketId, card });
      if (card.suit === 'SPADES' && !room.spadesBroken) {
        room.spadesBroken = true;
        console.log(`[bot] Spades broken by bot!`);
      }
      console.log(`[bot] ${name} plays ${card.rank} of ${card.suit}`);

      if (room.currentTrick.length === room.players.length) {
        completeTrick(room);
      } else {
        advanceTurn(room);
        broadcast(room);
      }
    }
  }, 2000); // 2-second delay so it doesn't feel instant
}

// ─── Socket Events ────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── create_room ────────────────────────────────────────────────────────────
  socket.on('create_room', ({ name, password, gameMode }) => {
    console.log(`[create_room] socket=${socket.id} name=${name}`);
    if (!name?.trim()) { socket.emit('error', { message: 'Name is required' }); return; }
    if (!password?.trim()) { socket.emit('error', { message: 'Password is required' }); return; }

    const { code, room } = createRoom(socket.id, name.trim(), gameMode || 'traditional');
    room.credentials[name.trim()] = password.trim();
    socket.join(code);
    socket.emit('room_created', { code });
    broadcastLobby(room);
    console.log(`[create_room] Room ${code} created by ${name}`);
  });

  // ── join_room ──────────────────────────────────────────────────────────────
  socket.on('join_room', ({ code, name, password }) => {
    console.log(`[join_room] socket=${socket.id} code=${code} name=${name}`);
    if (!name?.trim() || !code) { socket.emit('error', { message: 'Name and room code are required' }); return; }
    if (!password?.trim()) { socket.emit('error', { message: 'Password is required' }); return; }

    const upperCode = code.toUpperCase();
    const room = getRoom(upperCode);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

    // ── Rejoin during active game ────────────────────────────────────────────
    if (room.status === 'bidding' || room.status === 'playing') {
      const disconnectedPlayer = room.players.find(
        p => p.name === name.trim() && p.disconnected
      );
      if (disconnectedPlayer) {
        // Verify password
        if (room.credentials[name.trim()] !== password.trim()) {
          socket.emit('error', { message: 'Incorrect password — cannot rejoin' });
          return;
        }
        // Cancel any pending bot timer
        if (room.botTimers[name.trim()]) {
          clearTimeout(room.botTimers[name.trim()]);
          delete room.botTimers[name.trim()];
        }
        // Transfer the player slot to the new socket
        updateSocketId(upperCode, name.trim(), socket.id);
        disconnectedPlayer.disconnected = false;

        socket.join(upperCode);
        socket.emit('room_joined', { code: upperCode });
        broadcast(room);
        console.log(`[rejoin] ${name} rejoined room ${upperCode}`);
        return;
      }
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    // ── Normal join (lobby or finished) ──────────────────────────────────────
    const result = joinRoom(upperCode, socket.id, name.trim());
    if (!result.success) { socket.emit('error', { message: result.error }); return; }

    room.credentials[name.trim()] = password.trim();
    socket.join(upperCode);
    socket.emit('room_joined', { code: upperCode });
    if (result.room.status === 'lobby') broadcastLobby(result.room);
    else broadcast(result.room);
    console.log(`[join_room] ${name} joined room ${upperCode}`);
  });

  // ── set_target_score ───────────────────────────────────────────────────────
  socket.on('set_target_score', ({ code, targetScore }) => {
    console.log(`[set_target_score] socket=${socket.id} code=${code} target=${targetScore}`);
    const room = getRoom(code);
    if (!room || room.status !== 'lobby') return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) { socket.emit('error', { message: 'Only the host can set the target score' }); return; }
    const parsed = (targetScore === null || targetScore === 0) ? null : Number(targetScore);
    if (parsed !== null && ![100, 200].includes(parsed)) {
      socket.emit('error', { message: 'Target score must be 100, 200, or none' }); return;
    }
    room.targetScore = parsed;
    broadcastLobby(room);
    console.log(`[set_target_score] Room ${code} target set to ${parsed}`);
  });

  // ── start_game ─────────────────────────────────────────────────────────────
  socket.on('start_game', ({ code }) => {
    console.log(`[start_game] socket=${socket.id} code=${code}`);
    const room = getRoom(code);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) { socket.emit('error', { message: 'Only the host can start the game' }); return; }
    if (room.players.length < 2) { socket.emit('error', { message: 'Need at least 2 players to start' }); return; }
    if (room.status !== 'lobby') { socket.emit('error', { message: 'Game already started' }); return; }

    room.roundNumber = 1;
    room.spadesBroken = false;
    let hands;
    if (room.gameMode === 'gully') {
      hands = dealExactCards(room.players.length, getGullyCardsForRound(1, room.players.length));
    } else {
      hands = dealCards(room.players.length);
    }
    room.players.forEach((p, i) => { p.hand = hands[i]; });
    startBiddingPhase(room);
    console.log(`[start_game] Game started in room ${code} (mode: ${room.gameMode}, target: ${room.targetScore})`);
    logGameStart(room);
  });

  // ── submit_bid ─────────────────────────────────────────────────────────────
  socket.on('submit_bid', ({ code, bid }) => {
    console.log(`[submit_bid] socket=${socket.id} code=${code} bid=${bid}`);
    const room = getRoom(code);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.status !== 'bidding') { socket.emit('error', { message: 'Not in bidding phase' }); return; }
    if (room.currentTurn !== socket.id) { socket.emit('error', { message: 'Not your turn to bid' }); return; }

    const bidNum = parseInt(bid, 10);
    if (isNaN(bidNum) || bidNum < 0) { socket.emit('error', { message: 'Invalid bid' }); return; }

    if (room.gameMode === 'gully') {
      const submittedBids = room.players.filter(p => p.bid !== null).map(p => p.bid);
      const isLastBidder = submittedBids.length === room.players.length - 1;
      if (isLastBidder) {
        const previousSum = submittedBids.reduce((a, b) => a + b, 0);
        const cardsDealt = room.players.find(p => p.socketId === socket.id)?.hand?.length ?? 0;
        if (previousSum + bidNum === cardsDealt) {
          socket.emit('error', { message: `Bid ${bidNum} not allowed — total would equal the ${cardsDealt} tricks available this round` });
          return;
        }
      }
    }

    const player = room.players.find(p => p.socketId === socket.id);
    player.bid = bidNum;
    console.log(`[submit_bid] ${player.name} bid ${bidNum}`);
    if (allBidsSubmitted(room)) startPlayingPhase(room);
    else { advanceTurn(room); broadcast(room); }
  });

  // ── play_card ──────────────────────────────────────────────────────────────
  socket.on('play_card', ({ code, card }) => {
    console.log(`[play_card] socket=${socket.id} code=${code} card=${card.rank} of ${card.suit}`);
    const room = getRoom(code);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.status !== 'playing') { socket.emit('error', { message: 'Not in playing phase' }); return; }
    if (room.currentTurn !== socket.id) { socket.emit('error', { message: 'Not your turn' }); return; }

    const player = room.players.find(p => p.socketId === socket.id);
    const result = validatePlay(card, player.hand, room.leadSuit, room.spadesBroken);
    if (!result.valid) { socket.emit('error', { message: result.reason }); return; }

    player.hand = player.hand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
    if (room.currentTrick.length === 0) room.leadSuit = card.suit;
    room.currentTrick.push({ playerId: socket.id, card });
    if (card.suit === 'SPADES' && !room.spadesBroken) {
      room.spadesBroken = true;
      console.log(`[${code}] Spades broken!`);
    }
    console.log(`[play_card] ${player.name} played ${card.rank} of ${card.suit}`);

    if (room.currentTrick.length === room.players.length) {
      completeTrick(room);
    } else {
      advanceTurn(room);
      broadcast(room);
    }
  });

  // ── vote_rematch ───────────────────────────────────────────────────────────
  socket.on('vote_rematch', ({ code, vote }) => {
    console.log(`[vote_rematch] socket=${socket.id} code=${code} vote=${vote}`);
    const room = getRoom(code);
    if (!room || room.status !== 'finished') { socket.emit('error', { message: 'No finished game to rematch' }); return; }
    if (vote === false) {
      removePlayer(socket.id);
      socket.leave(code);
      if (room) broadcast(room);
    } else {
      if (!room.rematchVotes.includes(socket.id)) room.rematchVotes.push(socket.id);
      broadcast(room);
    }
  });

  // ── start_rematch ──────────────────────────────────────────────────────────
  socket.on('start_rematch', ({ code }) => {
    console.log(`[start_rematch] socket=${socket.id} code=${code}`);
    const room = getRoom(code);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.status !== 'finished') { socket.emit('error', { message: 'No finished game to rematch' }); return; }
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) { socket.emit('error', { message: 'Only the host can start the rematch' }); return; }
    if (room.players.length < 2) { socket.emit('error', { message: 'Need at least 2 players' }); return; }

    // Full reset — wipe credentials so everyone must re-enter for next game
    wipeCredentials(room);
    room.players.forEach(p => { p.score = 0; p.bid = null; p.tricksWon = 0; p.hand = []; p.disconnected = false; });
    room.handHistory = [];
    room.trickHistory = [];
    room.currentTrick = [];
    room.leadSuit = null;
    room.spadesBroken = false;
    room.winner = null;
    room.dealerIndex = 0;
    room.roundNumber = 1;
    room.rematchVotes = [];
    room.botTimers = {};

    let hands;
    if (room.gameMode === 'gully') {
      hands = dealExactCards(room.players.length, getGullyCardsForRound(1, room.players.length));
    } else {
      hands = dealCards(room.players.length);
    }
    room.players.forEach((p, i) => { p.hand = hands[i]; });
    startBiddingPhase(room);
    console.log(`[start_rematch] Rematch started in room ${code}`);
    logGameStart(room);
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const room = getRoomBySocketId(socket.id);
    if (!room) return;

    if (room.status === 'bidding' || room.status === 'playing') {
      // Active game: mark as disconnected — bot takes over
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.disconnected = true;
        console.log(`[disconnect] ${player.name} disconnected mid-game — bot taking over`);
        clearSocketMapping(socket.id); // remove stale mapping, keep player in room

        // If ALL players are now disconnected, delete the room entirely
        if (room.players.every(p => p.disconnected)) {
          Object.values(room.botTimers).forEach(t => clearTimeout(t));
          if (room.trickTimer) clearTimeout(room.trickTimer);
          logGameAbandoned(room);
          delete require('./roomManager').rooms[room.code];
          console.log(`[disconnect] All players gone — room ${room.code} deleted`);
          return;
        }

        broadcast(room); // triggers scheduleBot if it's their turn
      }
    } else {
      // Lobby or finished: remove normally
      const result = removePlayer(socket.id);
      if (!result) return;
      if (!result.deleted && result.room) {
        if (result.room.status === 'lobby') broadcastLobby(result.room);
        else broadcast(result.room);
        console.log(`[disconnect] Player removed from room ${result.code}`);
      } else {
        console.log(`[disconnect] Room ${result.code} deleted (empty)`);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Spades server listening on port ${PORT}`));
