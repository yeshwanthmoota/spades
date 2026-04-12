import React, { useState } from 'react';

export default function Lobby({ roomCode, gameState, mySocketId, onCreateRoom, onJoinRoom, onStartGame, errorMsg, onClearError }) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [view, setView] = useState('home'); // 'home' | 'create' | 'join' | 'waiting'

  const inRoom = !!roomCode && !!gameState;
  const me = gameState?.players?.find(p => p.socketId === mySocketId);
  const isHost = me?.isHost;
  const playerCount = gameState?.players?.length ?? 0;

  function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateRoom(name.trim());
    setView('waiting');
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!name.trim() || !joinCode.trim()) return;
    onJoinRoom(joinCode.trim().toUpperCase(), name.trim());
    setView('waiting');
  }

  if (inRoom && gameState.status === 'lobby') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
        <h1 className="text-4xl font-bold tracking-widest">♠ SPADES</h1>

        <div className="bg-felt rounded-2xl p-6 w-full max-w-md shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-300 text-sm">Room Code</span>
            <span className="text-3xl font-mono font-bold tracking-widest text-yellow-300">{roomCode}</span>
          </div>

          <p className="text-gray-300 text-sm mb-4">
            Share this code with friends. Need 4–6 players.
          </p>

          <div className="space-y-2 mb-6">
            {gameState.players.map((p, i) => (
              <div key={p.socketId} className="flex items-center gap-3 bg-felt-dark rounded-lg px-3 py-2">
                <span className="text-yellow-300 font-mono">{i + 1}</span>
                <span className="flex-1">{p.name}</span>
                {p.isHost && <span className="text-xs bg-yellow-400 text-black px-2 py-0.5 rounded-full font-semibold">HOST</span>}
                {p.socketId === mySocketId && <span className="text-xs text-gray-400">(you)</span>}
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="bg-red-800 text-red-200 rounded-lg p-3 mb-4 text-sm">
              {errorMsg}
              <button className="ml-2 underline" onClick={onClearError}>dismiss</button>
            </div>
          )}

          {isHost ? (
            <button
              onClick={() => onStartGame(roomCode)}
              disabled={playerCount < 4}
              className="w-full py-3 rounded-xl font-bold text-lg bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {playerCount < 4 ? `Waiting for players (${playerCount}/4 min)` : 'Start Game'}
            </button>
          ) : (
            <p className="text-center text-gray-400">Waiting for host to start…</p>
          )}
        </div>
      </div>
    );
  }

  // Home / create / join screen
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-2">♠</h1>
        <h2 className="text-4xl font-bold tracking-widest">SPADES</h2>
        <p className="text-gray-400 mt-1">4–6 players · Classic rules</p>
      </div>

      {view === 'home' && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => setView('create')}
            className="py-3 rounded-xl font-bold text-lg bg-yellow-400 text-black hover:bg-yellow-300 transition"
          >
            Create Room
          </button>
          <button
            onClick={() => setView('join')}
            className="py-3 rounded-xl font-bold text-lg border-2 border-yellow-400 text-yellow-300 hover:bg-felt transition"
          >
            Join Room
          </button>
        </div>
      )}

      {view === 'create' && (
        <form onSubmit={handleCreate} className="bg-felt rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
          <h3 className="text-xl font-bold">Create a Room</h3>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            className="w-full bg-felt-dark rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setView('home'); onClearError(); }}
              className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-felt-dark transition">
              Back
            </button>
            <button type="submit"
              className="flex-1 py-2 rounded-lg bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition">
              Create
            </button>
          </div>
        </form>
      )}

      {view === 'join' && (
        <form onSubmit={handleJoin} className="bg-felt rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
          <h3 className="text-xl font-bold">Join a Room</h3>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            className="w-full bg-felt-dark rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <input
            type="text"
            placeholder="Room code (e.g. AB3X)"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            className="w-full bg-felt-dark rounded-lg px-4 py-2 font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setView('home'); onClearError(); }}
              className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-felt-dark transition">
              Back
            </button>
            <button type="submit"
              className="flex-1 py-2 rounded-lg bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition">
              Join
            </button>
          </div>
        </form>
      )}

      {view === 'waiting' && !inRoom && (
        <div className="text-gray-400 animate-pulse">Connecting…</div>
      )}
    </div>
  );
}
