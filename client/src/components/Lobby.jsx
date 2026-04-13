import React, { useState } from 'react';

const INPUT = "w-full bg-felt-dark rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400";

export default function Lobby({
  roomCode, gameState, mySocketId,
  onCreateRoom, onJoinRoom, onStartGame, onSetTargetScore,
  errorMsg, onClearError,
}) {
  const [name, setName]         = useState('');
  const [password, setPassword] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [view, setView]         = useState('home'); // 'home'|'create'|'join'|'waiting'
  const [lastAction, setLastAction] = useState('create');

  const inRoom      = !!roomCode && !!gameState;
  const me          = gameState?.players?.find(p => p.socketId === mySocketId);
  const isHost      = me?.isHost;
  const playerCount = gameState?.players?.length ?? 0;
  const targetScore = gameState?.targetScore ?? 100;

  function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || !password.trim()) return;
    onClearError();
    setLastAction('create');
    onCreateRoom(name.trim(), password.trim());
    setView('waiting');
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!name.trim() || !joinCode.trim() || !password.trim()) return;
    onClearError();
    setLastAction('join');
    onJoinRoom(joinCode.trim().toUpperCase(), name.trim(), password.trim());
    setView('waiting');
  }

  // ── Waiting room (lobby status) ────────────────────────────────────────────
  if (inRoom && gameState.status === 'lobby') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
        <h1 className="text-4xl font-bold tracking-widest">♠ SPADES</h1>

        <div className="bg-felt rounded-2xl p-6 w-full max-w-md shadow-xl border border-white/5 space-y-5">
          {/* Room code */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">Room Code</span>
            <span className="text-3xl font-mono font-bold tracking-widest text-yellow-300">{roomCode}</span>
          </div>

          <p className="text-gray-400 text-sm -mt-2">
            Share this code with friends · 2–8 players
          </p>

          {/* Player list */}
          <div className="space-y-2">
            {gameState.players.map((p, i) => (
              <div key={p.socketId} className="flex items-center gap-3 bg-felt-dark rounded-lg px-3 py-2">
                <span className="text-yellow-300 font-mono text-sm">{i + 1}</span>
                <span className="flex-1 text-sm">{p.name}</span>
                {p.isHost && <span className="text-xs bg-yellow-400 text-black px-2 py-0.5 rounded-full font-semibold">HOST</span>}
                {p.socketId === mySocketId && <span className="text-xs text-gray-500">(you)</span>}
              </div>
            ))}
          </div>

          {/* Target score selector — host only */}
          <div>
            <p className="text-gray-400 text-sm mb-2">
              {isHost ? 'Win condition:' : `Win condition: first to ${targetScore} pts`}
            </p>
            {isHost && (
              <div className="flex gap-3">
                {[100, 200].map(t => (
                  <button
                    key={t}
                    onClick={() => onSetTargetScore(roomCode, t)}
                    className={`flex-1 py-2 rounded-xl font-bold border transition text-sm
                      ${targetScore === t
                        ? 'bg-yellow-400 text-black border-yellow-400'
                        : 'bg-felt-dark border-gray-600 text-gray-300 hover:border-yellow-400 hover:text-yellow-300'}`}
                  >
                    Play to {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="bg-red-800 text-red-200 rounded-lg p-3 text-sm flex justify-between items-center">
              <span>{errorMsg}</span>
              <button className="underline text-xs ml-2" onClick={onClearError}>dismiss</button>
            </div>
          )}

          {isHost ? (
            <button
              onClick={() => onStartGame(roomCode)}
              disabled={playerCount < 2}
              className="w-full py-3 rounded-xl font-bold text-lg bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {playerCount < 2 ? `Waiting for players (${playerCount}/2 min)` : `Start Game → Play to ${targetScore}`}
            </button>
          ) : (
            <p className="text-center text-gray-400 text-sm">Waiting for host to start…</p>
          )}
        </div>
      </div>
    );
  }

  // ── Home / create / join screens ───────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-2">♠</h1>
        <h2 className="text-4xl font-bold tracking-widest">SPADES</h2>
        <p className="text-gray-400 mt-1">2–8 players · Classic rules</p>
      </div>

      {view === 'home' && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => setView('create')}
            className="py-3 rounded-xl font-bold text-lg bg-yellow-400 text-black hover:bg-yellow-300 transition">
            Create Room
          </button>
          <button onClick={() => setView('join')}
            className="py-3 rounded-xl font-bold text-lg border-2 border-yellow-400 text-yellow-300 hover:bg-felt transition">
            Join / Rejoin Room
          </button>
        </div>
      )}

      {view === 'create' && (
        <form onSubmit={handleCreate} className="bg-felt rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 border border-white/5">
          <h3 className="text-xl font-bold">Create a Room</h3>
          <input type="text" placeholder="Your display name" value={name}
            onChange={e => setName(e.target.value)} maxLength={20} className={INPUT} />
          <div>
            <input type="password" placeholder="Set a session password" value={password}
              onChange={e => setPassword(e.target.value)} maxLength={30} className={INPUT} />
            <p className="text-gray-500 text-xs mt-1">Used to rejoin if you disconnect mid-game</p>
          </div>
          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setView('home'); onClearError(); }}
              className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-felt-dark transition">Back</button>
            <button type="submit"
              className="flex-1 py-2 rounded-lg bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition">Create</button>
          </div>
        </form>
      )}

      {view === 'join' && (
        <form onSubmit={handleJoin} className="bg-felt rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 border border-white/5">
          <h3 className="text-xl font-bold">Join / Rejoin Room</h3>
          <input type="text" placeholder="Room code (e.g. AB3X)" value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={4}
            className={`${INPUT} font-mono tracking-widest uppercase`} />
          <input type="text" placeholder="Your display name" value={name}
            onChange={e => setName(e.target.value)} maxLength={20} className={INPUT} />
          <div>
            <input type="password" placeholder="Session password" value={password}
              onChange={e => setPassword(e.target.value)} maxLength={30} className={INPUT} />
            <p className="text-gray-500 text-xs mt-1">Use your original password to rejoin a game in progress</p>
          </div>
          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setView('home'); onClearError(); }}
              className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-felt-dark transition">Back</button>
            <button type="submit"
              className="flex-1 py-2 rounded-lg bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition">Join</button>
          </div>
        </form>
      )}

      {view === 'waiting' && !inRoom && (
        errorMsg ? (
          <div className="bg-felt rounded-2xl p-6 w-full max-w-sm shadow-xl border border-white/5 text-center space-y-4">
            <p className="text-red-400 font-semibold">{errorMsg}</p>
            <button
              onClick={() => { setView(lastAction); onClearError(); }}
              className="w-full py-2 rounded-lg bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition">
              Try Again
            </button>
          </div>
        ) : (
          <div className="text-gray-400 animate-pulse">Connecting…</div>
        )
      )}
    </div>
  );
}
