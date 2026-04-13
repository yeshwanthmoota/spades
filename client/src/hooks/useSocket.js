import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setMySocketId(socket.id);
      console.log('Connected:', socket.id);
    });
    socket.on('disconnect', () => { setConnected(false); console.log('Disconnected'); });
    socket.on('room_created', ({ code }) => { setRoomCode(code); setErrorMsg(null); });
    socket.on('room_joined',  ({ code }) => { setRoomCode(code); setErrorMsg(null); });
    socket.on('room_update',  (state)   => setGameState(state));
    socket.on('game_update',  (state)   => setGameState(state));
    socket.on('error', ({ message }) => { setErrorMsg(message); console.error('Server error:', message); });

    return () => socket.disconnect();
  }, []);

  const createRoom      = useCallback((name, password, gameMode) => socketRef.current?.emit('create_room',      { name, password, gameMode }), []);
  const joinRoom        = useCallback((code, name, password)  => socketRef.current?.emit('join_room',        { code, name, password }), []);
  const startGame       = useCallback((code)                  => socketRef.current?.emit('start_game',       { code }), []);
  const submitBid       = useCallback((code, bid)             => socketRef.current?.emit('submit_bid',       { code, bid }), []);
  const playCard        = useCallback((code, card)            => socketRef.current?.emit('play_card',        { code, card }), []);
  const voteRematch     = useCallback((code, vote)            => socketRef.current?.emit('vote_rematch',     { code, vote }), []);
  const startRematch    = useCallback((code)                  => socketRef.current?.emit('start_rematch',    { code }), []);
  const setTargetScore  = useCallback((code, targetScore)     => socketRef.current?.emit('set_target_score', { code, targetScore }), []);
  const clearError      = useCallback(()                      => setErrorMsg(null), []);

  return {
    connected, roomCode, gameState, errorMsg, mySocketId,
    createRoom, joinRoom, startGame, submitBid, playCard,
    voteRematch, startRematch, setTargetScore, clearError,
  };
}
