import { create } from 'zustand';
import { socket } from './socket.js';

const ERROR_TEXT = {
  ROOM_NOT_FOUND: 'That room does not exist any more.',
  LOGIN_REQUIRED: 'Please log in to play.',
  ROOM_FULL: 'This room is full.',
  GAME_STARTED: 'This game has already started.',
  INVALID_INPUT: 'That does not look like a valid room code.',
  NOT_HOST: 'Only the host can do that.',
};
const errorText = (code) => ERROR_TEXT[code] || 'Something went wrong. Please try again.';

// a marker that this tab already holds a seat; the server re-attaches us by account on every (re)join
const storageKey = (code) => `qv_room_${code}`;
export function savedSession(code) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(code))) ?? {};
  } catch {
    return {};
  }
}
const saveSession = (code, value) => {
  try { sessionStorage.setItem(storageKey(code), JSON.stringify(value)); } catch { /* storage unavailable */ }
};
const clearSession = (code) => {
  try { sessionStorage.removeItem(storageKey(code)); } catch { /* storage unavailable */ }
};

function ensureConnected() {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error('Could not reach the server.'));
    }, 8000);
    function onConnect() {
      done();
      resolve();
    }
    // the server refuses sockets that are not signed in
    function onError(err) {
      done();
      reject(new Error(err.message === 'LOGIN_REQUIRED' ? errorText('LOGIN_REQUIRED') : 'Could not reach the server.'));
    }
    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
    socket.connect();
  });
}

async function emitJoin(code) {
  await ensureConnected();
  const res = await socket
    .timeout(8000)
    .emitWithAck('room:join', { code });
  if (!res.ok) throw new Error(errorText(res.error));
  saveSession(code, { playerId: res.playerId });
  return res;
}

// The server sends "time remaining", never a clock time. Turn it into a local deadline on arrival.
const withDeadline = (question) => ({ ...question, endsAt: Date.now() + question.remainingMs });

const EMPTY_GAME = {
  phase: null, // countdown | question | reveal | leaderboard | finished
  countdownEndsAt: null,
  question: null,
  myChoice: null,
  progress: { answered: 0, total: 0 },
  reveal: null,
  leaderboard: null,
  final: null,
};

function gameFromSnapshot(snap) {
  if (!snap) return null;
  return {
    ...EMPTY_GAME,
    phase: snap.phase,
    countdownEndsAt: snap.remainingMs != null ? Date.now() + snap.remainingMs : null,
    question: snap.question ? withDeadline(snap.question) : null,
    myChoice: snap.question?.myChoice ?? null,
    progress: snap.progress ?? EMPTY_GAME.progress,
    reveal: snap.reveal ?? null,
    leaderboard: snap.leaderboard ?? null,
    final: snap.final ?? null,
  };
}

export const useRoom = create((set, get) => ({
  room: null, // latest public room state from the server
  playerId: null,
  notice: null, // set when we are kicked or the room closes
  game: null, // live game state, null while in the lobby

  async join(code) {
    const res = await emitJoin(code);
    set({ room: res.state, playerId: res.playerId, notice: null, game: gameFromSnapshot(res.game) });
  },

  leave() {
    const { room } = get();
    socket.emit('room:leave');
    if (room) clearSession(room.code);
    set({ room: null, playerId: null, notice: null, game: null });
  },

  async start() {
    const res = await socket.timeout(8000).emitWithAck('game:start', {});
    if (!res.ok) throw new Error(errorText(res.error));
  },

  async answer(choice) {
    const { game } = get();
    if (game?.phase !== 'question' || game.myChoice !== null) return;
    const qIndex = game.question.qIndex;
    set({ game: { ...game, myChoice: choice } }); // lock in instantly, the server confirms
    try {
      await socket.timeout(5000).emitWithAck('answer:submit', { qIndex, choice });
    } catch {
      // no reply at all (not a rejection): let the player try again
      const current = get().game;
      if (current?.question?.qIndex === qIndex) set({ game: { ...current, myChoice: null } });
    }
  },

  kick: (playerId) => socket.emit('room:kick', { playerId }),
  clearNotice: () => set({ notice: null }),
}));

const patchGame = (patch) =>
  useRoom.setState((s) => (s.room ? { game: { ...(s.game ?? EMPTY_GAME), ...patch } } : {}));

// server -> client events
socket.on('room:state', (state) => {
  if (useRoom.getState().room?.code === state.code) useRoom.setState({ room: state });
});

socket.on('game:countdown', ({ remainingMs }) =>
  patchGame({ ...EMPTY_GAME, phase: 'countdown', countdownEndsAt: Date.now() + remainingMs })
);
socket.on('question:show', (question) =>
  patchGame({
    phase: 'question',
    question: withDeadline(question),
    myChoice: null,
    progress: EMPTY_GAME.progress,
    reveal: null,
    leaderboard: null,
  })
);
socket.on('answers:progress', (progress) => patchGame({ progress }));
socket.on('question:reveal', (reveal) => patchGame({ phase: 'reveal', reveal }));
socket.on('leaderboard:update', (leaderboard) => patchGame({ phase: 'leaderboard', leaderboard }));
socket.on('game:finished', (final) => patchGame({ phase: 'finished', final }));

socket.on('room:kicked', () => {
  const { room } = useRoom.getState();
  if (room) clearSession(room.code);
  useRoom.setState({ room: null, playerId: null, game: null, notice: 'The host removed you from this room.' });
});

socket.on('room:closed', () => {
  const { room, game } = useRoom.getState();
  if (game?.phase === 'finished') return; // keep showing the results
  if (room) clearSession(room.code);
  useRoom.setState({ room: null, playerId: null, game: null, notice: 'This room was closed.' });
});

// the server forgets our socket on a reconnect, so take our seat back (and catch up on the game)
socket.on('connect', async () => {
  const { room } = useRoom.getState();
  if (!room) return;
  try {
    const res = await emitJoin(room.code);
    useRoom.setState({ room: res.state, playerId: res.playerId, game: gameFromSnapshot(res.game) });
  } catch (err) {
    useRoom.setState({ room: null, playerId: null, game: null, notice: err.message });
  }
});
