const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const {
  dealCards,
  validatePlay,
  determineTrickWinner,
  calculateScore,
} = require('./gameLogic');
const {
  createRoom,
  joinRoom,
  removePlayer,
  getRoom,
  getRoomBySocketId,
} = require('./roomManager');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Serve React build
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function roomView(room, requestingSocketId) {
  return {
    ...room,
    players: room.players.map(p => ({
      ...p,
      hand: p.socketId === requestingSocketId ? p.hand : p.hand.map(() => ({ hidden: true })),
    })),
  };
}

// Single broadcast used for all phases — always sends game_update
function broadcast(room) {
  for (const player of room.players) {
    const sock = io.sockets.sockets.get(player.socketId);
    if (sock) sock.emit('game_update', roomView(room, player.socketId));
  }
}

// Lobby uses room_update so the client can route correctly
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
  console.log(`[${room.code}] Bidding phase. First bidder: ${room.currentTurn}`);
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
  console.log(`[${room.code}] Playing phase. First lead: ${room.currentTurn}`);
  broadcast(room);
}

function advanceTurn(room) {
  const currentIndex = room.players.findIndex(p => p.socketId === room.currentTurn);
  room.currentTurn = room.players[nextPlayerIndex(room, currentIndex)].socketId;
}

function checkHandComplete(room) {
  return room.players.every(p => p.hand.length === 0);
}

function resolveHand(room) {
  let gameOver = false;
  for (const player of room.players) {
    const earned = calculateScore(player.bid, player.tricksWon);
    player.score += earned;
    console.log(`[${room.code}] ${player.name}: bid=${player.bid} won=${player.tricksWon} earned=${earned} total=${player.score}`);
  }

  room.handHistory.push(
    room.players.map(p => ({ name: p.name, bid: p.bid, tricksWon: p.tricksWon, score: p.score }))
  );

  const maxScore = Math.max(...room.players.map(p => p.score));
  if (maxScore >= room.targetScore) {
    const leaders = room.players.filter(p => p.score === maxScore);
    if (leaders.length === 1) {
      room.status = 'finished';
      room.winner = leaders[0].name;
      room.rematchVotes = [];
      gameOver = true;
      console.log(`[${room.code}] Game over! Winner: ${room.winner}`);
    } else {
      console.log(`[${room.code}] Tie at ${maxScore} — playing another round`);
    }
  }

  if (!gameOver) {
    room.dealerIndex = nextPlayerIndex(room, room.dealerIndex);
    room.roundNumber += 1;
    const hands = dealCards(room.players.length);
    room.players.forEach((p, i) => { p.hand = hands[i]; p.bid = null; p.tricksWon = 0; });
    room.spadesBroken = false;
    startBiddingPhase(room);
  } else {
    broadcast(room);
  }
}

// ─── Socket Events ───────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── create_room ──────────────────────────────────────────────────────────
  socket.on('create_room', ({ name }) => {
    console.log(`[create_room] socket=${socket.id} name=${name}`);
    if (!name || !name.trim()) { socket.emit('error', { message: 'Name is required' }); return; }
    const { code, room } = createRoom(socket.id, name.trim());
    socket.join(code);
    socket.emit('room_created', { code });
    broadcastLobby(room);
    console.log(`[create_room] Room ${code} created by ${name}`);
  });

  // ── join_room ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ code, name }) => {
    console.log(`[join_room] socket=${socket.id} code=${code} name=${name}`);
    if (!name || !name.trim() || !code) { socket.emit('error', { message: 'Name and room code are required' }); return; }
    const result = joinRoom(code.toUpperCase(), socket.id, name.trim());
    if (!result.success) { socket.emit('error', { message: result.error }); return; }
    socket.join(code.toUpperCase());
    socket.emit('room_joined', { code: code.toUpperCase() });
    // Use appropriate broadcast depending on room status
    if (result.room.status === 'lobby') broadcastLobby(result.room);
    else broadcast(result.room);
    console.log(`[join_room] ${name} joined room ${code.toUpperCase()} (status: ${result.room.status})`);
  });

  // ── start_game ────────────────────────────────────────────────────────────
  socket.on('start_game', ({ code }) => {
    console.log(`[start_game] socket=${socket.id} code=${code}`);
    const room = getRoom(code);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.isHost) { socket.emit('error', { message: 'Only the host can start the game' }); return; }
    if (room.players.length < 2) { socket.emit('error', { message: 'Need at least 2 players to start' }); return; }
    if (room.status !== 'lobby') { socket.emit('error', { message: 'Game already started' }); return; }

    const hands = dealCards(room.players.length);
    room.players.forEach((p, i) => { p.hand = hands[i]; });
    room.roundNumber = 1;
    room.spadesBroken = false;
    startBiddingPhase(room);
    console.log(`[start_game] Game started in room ${code} with ${room.players.length} players`);
  });

  // ── submit_bid ────────────────────────────────────────────────────────────
  socket.on('submit_bid', ({ code, bid }) => {
    console.log(`[submit_bid] socket=${socket.id} code=${code} bid=${bid}`);
    const room = getRoom(code);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.status !== 'bidding') { socket.emit('error', { message: 'Not in bidding phase' }); return; }
    if (room.currentTurn !== socket.id) { socket.emit('error', { message: 'Not your turn to bid' }); return; }

    const bidNum = parseInt(bid, 10);
    if (isNaN(bidNum) || bidNum < 1) { socket.emit('error', { message: 'Bid must be at least 1' }); return; }

    const player = room.players.find(p => p.socketId === socket.id);
    player.bid = bidNum;
    console.log(`[submit_bid] ${player.name} bid ${bidNum} in room ${code}`);

    if (allBidsSubmitted(room)) startPlayingPhase(room);
    else { advanceTurn(room); broadcast(room); }
  });

  // ── play_card ─────────────────────────────────────────────────────────────
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
      const winnerId = determineTrickWinner(room.currentTrick);
      const winner = room.players.find(p => p.socketId === winnerId);
      winner.tricksWon += 1;
      console.log(`[${code}] Trick won by ${winner.name}`);
      room.trickHistory.push([...room.currentTrick]);
      room.currentTrick = [];
      room.leadSuit = null;
      room.currentTurn = winnerId;
      broadcast(room);
      if (checkHandComplete(room)) {
        console.log(`[${code}] Hand complete — resolving scores`);
        resolveHand(room);
      }
    } else {
      advanceTurn(room);
      broadcast(room);
    }
  });

  // ── vote_rematch ──────────────────────────────────────────────────────────
  socket.on('vote_rematch', ({ code, vote }) => {
    console.log(`[vote_rematch] socket=${socket.id} code=${code} vote=${vote}`);
    const room = getRoom(code);
    if (!room || room.status !== 'finished') { socket.emit('error', { message: 'No game to rematch' }); return; }

    if (vote === false) {
      // Player opts out — remove them from the room
      removePlayer(socket.id);
      socket.leave(code);
      console.log(`[vote_rematch] Player left the room (no rematch)`);
      if (room) broadcast(room);
    } else {
      // Player wants to play again
      if (!room.rematchVotes.includes(socket.id)) room.rematchVotes.push(socket.id);
      console.log(`[vote_rematch] ${socket.id} voted yes (${room.rematchVotes.length}/${room.players.length})`);
      broadcast(room);
    }
  });

  // ── start_rematch ─────────────────────────────────────────────────────────
  socket.on('start_rematch', ({ code }) => {
    console.log(`[start_rematch] socket=${socket.id} code=${code}`);
    const room = getRoom(code);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.status !== 'finished') { socket.emit('error', { message: 'No finished game to rematch' }); return; }
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.isHost) { socket.emit('error', { message: 'Only the host can start the rematch' }); return; }
    if (room.players.length < 2) { socket.emit('error', { message: 'Need at least 2 players' }); return; }

    // Reset game state — fresh scores, keep players and room code
    room.players.forEach(p => { p.score = 0; p.bid = null; p.tricksWon = 0; p.hand = []; });
    room.handHistory = [];
    room.trickHistory = [];
    room.currentTrick = [];
    room.leadSuit = null;
    room.spadesBroken = false;
    room.winner = null;
    room.dealerIndex = 0;
    room.roundNumber = 1;
    room.rematchVotes = [];

    const hands = dealCards(room.players.length);
    room.players.forEach((p, i) => { p.hand = hands[i]; });

    startBiddingPhase(room);
    console.log(`[start_rematch] Rematch started in room ${code} with ${room.players.length} players`);
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const result = removePlayer(socket.id);
    if (!result) return;
    if (!result.deleted && result.room) {
      if (result.room.status === 'lobby') broadcastLobby(result.room);
      else broadcast(result.room);
      console.log(`[disconnect] Player removed from room ${result.code}`);
    } else {
      console.log(`[disconnect] Room ${result.code} deleted (empty)`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Spades server listening on port ${PORT}`);
});
