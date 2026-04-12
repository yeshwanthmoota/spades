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
    targetScore: 200,
    handHistory: [],
    trickHistory: [],
    roundNumber: 0,
  };

  socketRoomMap[socketId] = code;
  return { code, room: rooms[code] };
}

function joinRoom(code, socketId, name) {
  const room = rooms[code];
  if (!room) return { success: false, error: 'Room not found' };
  if (room.status !== 'lobby') return { success: false, error: 'Game already in progress' };
  if (room.players.length >= 6) return { success: false, error: 'Room is full (max 6 players)' };
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

  socketRoomMap[socketId] = code;
  return { success: true, room };
}

function removePlayer(socketId) {
  const code = socketRoomMap[socketId];
  if (!code) return null;

  const room = rooms[code];
  if (!room) { delete socketRoomMap[socketId]; return null; }

  room.players = room.players.filter(p => p.socketId !== socketId);
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

module.exports = {
  rooms,
  createRoom,
  joinRoom,
  removePlayer,
  getRoom,
  getRoomBySocketId,
};
