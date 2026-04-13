const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const {
  dealCards,
  validatePlay,
  determineTrickWinner,
  calculateScore,
  isSpadesBroken,
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

/** Strip hands from all players except the requesting socket */
function roomView(room, requestingSocketId) {
  return {
    ...room,
    players: room.players.map(p => ({
      ...p,
      hand: p.socketId === requestingSocketId ? p.hand : p.hand.map(() => ({ hidden: true })),
    })),
  };
}

function broadcastRoom(room) {
  for (const player of room.players) {
    const sock = io.sockets.sockets.get(player.socketId);
    if (sock) {
      sock.emit('room_update', roomView(room, player.socketId));
    }
  }
}

function broadcastGame(room) {
  for (const player of room.players) {
    const sock = io.sockets.sockets.get(player.socketId);
    if (sock) {
      sock.emit('game_update', roomView(room, player.socketId));
    }
  }
}

function nextPlayerIndex(room, currentIndex) {
  return (currentIndex + 1) % room.players.length;
}

function startBiddingPhase(room) {
  room.status = 'bidding';
  // Player left of dealer bids first
  const firstBidderIndex = nextPlayerIndex(room, room.dealerIndex);
  room.currentTurn = room.players[firstBidderIndex].socketId;
  room.players.forEach(p => { p.bid = null; p.tricksWon = 0; });
  console.log(`[${room.code}] Bidding phase started. First bidder: ${room.currentTurn}`);
  broadcastGame(room);
}

function allBidsSubmitted(room) {
  return room.players.every(p => p.bid !== null);
}

function startPlayingPhase(room) {
  room.status = 'playing';
  room.currentTrick = [];
  room.leadSuit = null;
  room.trickHistory = [];
  // Player left of dealer leads first
  const firstLeaderIndex = nextPlayerIndex(room, room.dealerIndex);
  room.currentTurn = room.players[firstLeaderIndex].socketId;
  console.log(`[${room.code}] Playing phase started. First lead: ${room.currentTurn}`);
  broadcastGame(room);
}

function advanceTurn(room) {
  const currentIndex = room.players.findIndex(p => p.socketId === room.currentTurn);
  const nextIndex = nextPlayerIndex(room, currentIndex);
  room.currentTurn = room.players[nextIndex].socketId;
}

function checkHandComplete(room) {
  return room.players.every(p => p.hand.length === 0);
}

function resolveHand(room) {
  // Score this hand
  let gameOver = false;
  for (const player of room.players) {
    const earned = calculateScore(player.bid, player.tricksWon);
    player.score += earned;
    console.log(`[${room.code}] ${player.name}: bid=${player.bid} won=${player.tricksWon} earned=${earned} total=${player.score}`);
  }

  // Save hand to history
  room.handHistory.push(
    room.players.map(p => ({ name: p.name, bid: p.bid, tricksWon: p.tricksWon, score: p.score }))
  );

  // Check win condition
  const maxScore = Math.max(...room.players.map(p => p.score));
  if (maxScore >= room.targetScore) {
    const leaders = room.players.filter(p => p.score === maxScore);
    if (leaders.length === 1) {
      room.status = 'finished';
      room.winner = leaders[0].name;
      gameOver = true;
      console.log(`[${room.code}] Game over! Winner: ${room.winner}`);
    } else {
      console.log(`[${room.code}] Tie at ${maxScore} — playing another round`);
    }
  }

  if (!gameOver) {
    // Rotate dealer and deal again
    room.dealerIndex = nextPlayerIndex(room, room.dealerIndex);
    room.roundNumber += 1;
    const hands = dealCards(room.players.length);
    room.players.forEach((p, i) => {
      p.hand = hands[i];
      p.bid = null;
      p.tricksWon = 0;
    });
    room.spadesBroken = false;
    startBiddingPhase(room);
  } else {
    broadcastGame(room);
  }
}

// ─── Socket Events ───────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── create_room ──────────────────────────────────────────────────────────
  socket.on('create_room', ({ name }) => {
    console.log(`[create_room] socket=${socket.id} name=${name}`);
    if (!name || !name.trim()) {
      socket.emit('error', { message: 'Name is required' });
      return;
    }
    const { code, room } = createRoom(socket.id, name.trim());
    socket.join(code);
    socket.emit('room_created', { code });
    broadcastRoom(room);
    console.log(`[create_room] Room ${code} created by ${name}`);
  });

  // ── join_room ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ code, name }) => {
    console.log(`[join_room] socket=${socket.id} code=${code} name=${name}`);
    if (!name || !name.trim() || !code) {
      socket.emit('error', { message: 'Name and room code are required' });
      return;
    }
    const result = joinRoom(code.toUpperCase(), socket.id, name.trim());
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }
    socket.join(code.toUpperCase());
    socket.emit('room_joined', { code: code.toUpperCase() });
    broadcastRoom(result.room);
    console.log(`[join_room] ${name} joined room ${code.toUpperCase()}`);
  });

  // ── start_game ────────────────────────────────────────────────────────────
  socket.on('start_game', ({ code }) => {
    console.log(`[start_game] socket=${socket.id} code=${code}`);
    const room = getRoom(code);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.isHost) {
      socket.emit('error', { message: 'Only the host can start the game' });
      return;
    }
    if (room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' });
      return;
    }
    if (room.status !== 'lobby') {
      socket.emit('error', { message: 'Game already started' });
      return;
    }

    // Deal cards
    const hands = dealCards(room.players.length);
    room.players.forEach((p, i) => { p.hand = hands[i]; });
    room.roundNumber = 1;
    room.spadesBroken = false;

    startBiddingPhase(room);
    console.log(`[start_game] Game started in room ${code}`);
  });

  // ── submit_bid ────────────────────────────────────────────────────────────
  socket.on('submit_bid', ({ code, bid }) => {
    console.log(`[submit_bid] socket=${socket.id} code=${code} bid=${bid}`);
    const room = getRoom(code);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.status !== 'bidding') { socket.emit('error', { message: 'Not in bidding phase' }); return; }
    if (room.currentTurn !== socket.id) { socket.emit('error', { message: 'Not your turn to bid' }); return; }

    const bidNum = parseInt(bid, 10);
    if (isNaN(bidNum) || bidNum < 1) {
      socket.emit('error', { message: 'Bid must be at least 1' });
      return;
    }

    const player = room.players.find(p => p.socketId === socket.id);
    player.bid = bidNum;
    console.log(`[submit_bid] ${player.name} bid ${bidNum} in room ${code}`);

    if (allBidsSubmitted(room)) {
      startPlayingPhase(room);
    } else {
      advanceTurn(room);
      broadcastGame(room);
    }
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
    if (!result.valid) {
      socket.emit('error', { message: result.reason });
      return;
    }

    // Remove card from hand
    player.hand = player.hand.filter(c => !(c.suit === card.suit && c.rank === card.rank));

    // Add to current trick
    if (room.currentTrick.length === 0) {
      room.leadSuit = card.suit;
    }
    room.currentTrick.push({ playerId: socket.id, card });

    // Break spades
    if (card.suit === 'SPADES' && !room.spadesBroken) {
      room.spadesBroken = true;
      console.log(`[${code}] Spades broken!`);
    }

    console.log(`[play_card] ${player.name} played ${card.rank} of ${card.suit}`);

    // Check if trick is complete
    if (room.currentTrick.length === room.players.length) {
      const winnerId = determineTrickWinner(room.currentTrick);
      const winner = room.players.find(p => p.socketId === winnerId);
      winner.tricksWon += 1;

      console.log(`[${code}] Trick won by ${winner.name} (${winnerId})`);

      room.trickHistory.push([...room.currentTrick]);
      room.currentTrick = [];
      room.leadSuit = null;
      room.currentTurn = winnerId;

      // Broadcast the completed trick result briefly before resetting
      broadcastGame(room);

      if (checkHandComplete(room)) {
        console.log(`[${code}] Hand complete — resolving scores`);
        resolveHand(room);
      }
    } else {
      advanceTurn(room);
      broadcastGame(room);
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const result = removePlayer(socket.id);
    if (!result) return;

    if (!result.deleted && result.room) {
      broadcastRoom(result.room);
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
