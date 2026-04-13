const rooms = {};

// Map socketId -> roomCode for fast cleanup on disconnect
const socketRoomMap = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(socketId, name) {
  let code;
  do { code = generateCode(); } while (rooms[code]);

  rooms[code] = {
    code,
    status: 'lobby',
    players: [
      {
        id: socketId,
        name,
        socketId,
        hand: [],
        bid: null,
        tricksWon: 0,
        score: 0,
        isHost: true,
      },
    ],
    dealerIndex: 0,
    currentTurn: null,
    currentTrick: [],
    leadSuit: null,
    spadesBroken: false,
    targetScore: 100,
    handHistory: [],
    trickHistory: [],
    roundNumber: 0,
    rematchVotes: [],     // socketIds of players who voted to play again
    credentials: {},      // { [playerName]: password } — wiped at game end
    botTimers: {},        // { [playerName]: timeoutId } — pending bot moves
  };

  socketRoomMap[socketId] = code;
  return { code, room: rooms[code] };
}

function joinRoom(code, socketId, name) {
  const room = rooms[code];
  if (!room) return { success: false, error: 'Room not found' };

  // Allow joining lobby rooms AND finished rooms (rematch waiting)
  if (room.status !== 'lobby' && room.status !== 'finished') {
    return { success: false, error: 'Game already in progress' };
  }
  if (room.players.length >= 8) return { success: false, error: 'Room is full (max 8 players)' };
  if (room.players.some(p => p.socketId === socketId)) {
    return { success: false, error: 'Already in room' };
  }

  room.players.push({
    id: socketId,
    name,
    socketId,
    hand: [],
    bid: null,
    tricksWon: 0,
    score: 0,
    isHost: false,
  });

  // New joiners during rematch phase are auto-counted as wanting to play
  if (room.status === 'finished' && !room.rematchVotes.includes(socketId)) {
    room.rematchVotes.push(socketId);
  }

  socketRoomMap[socketId] = code;
  return { success: true, room };
}

function removePlayer(socketId) {
  const code = socketRoomMap[socketId];
  if (!code) return null;

  const room = rooms[code];
  if (!room) { delete socketRoomMap[socketId]; return null; }

  room.players = room.players.filter(p => p.socketId !== socketId);
  room.rematchVotes = room.rematchVotes.filter(id => id !== socketId);
  delete socketRoomMap[socketId];

  // If room is empty, delete it
  if (room.players.length === 0) {
    delete rooms[code];
    return { code, deleted: true, room: null };
  }

  // If host left, assign new host
  if (!room.players.some(p => p.isHost)) {
    room.players[0].isHost = true;
  }

  return { code, deleted: false, room };
}

function getRoom(code) {
  return rooms[code] || null;
}

function getRoomBySocketId(socketId) {
  const code = socketRoomMap[socketId];
  return code ? rooms[code] : null;
}

/** Remove a socket from the room map without removing the player from the room.
 *  Used when a player disconnects mid-game (bot takes over, slot stays). */
function clearSocketMapping(socketId) {
  delete socketRoomMap[socketId];
}

/** Reassign a player's socketId — used on rejoin.
 *  Updates both the socketRoomMap and the player object inside the room. */
function updateSocketId(code, playerName, newSocketId) {
  const room = rooms[code];
  if (!room) return false;
  const player = room.players.find(p => p.name === playerName);
  if (!player) return false;

  // Clean up old mapping
  delete socketRoomMap[player.socketId];

  // Apply new socket
  player.socketId = newSocketId;
  player.id = newSocketId;
  socketRoomMap[newSocketId] = code;
  return true;
}

module.exports = {
  rooms,
  createRoom,
  joinRoom,
  removePlayer,
  getRoom,
  getRoomBySocketId,
  clearSocketMapping,
  updateSocketId,
};
