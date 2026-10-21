import { randomBytes, randomUUID } from 'node:crypto';

// Rooms live in memory while a game is running; finished games are persisted in a later milestone.
const rooms = new Map();

export const MAX_PLAYERS = 30;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid mix-ups
const PLAYER_GRACE_MS = 30_000;
const HOST_GRACE_MS = 60_000;
const IDLE_ROOM_TTL_MS = 10 * 60_000;

// the socket layer registers these so timers in here can reach connected clients
const hooks = { onChange: () => {}, onClosed: () => {} };
export function setRoomHooks(next) {
  Object.assign(hooks, next);
}

function makeCode() {
  for (;;) {
    const bytes = randomBytes(6);
    const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
    if (!rooms.has(code)) return code;
  }
}

export const getRoom = (code) => rooms.get(String(code).toUpperCase());

export function createRoom({ hostUserId, topic, settings, questions, source }) {
  // one open lobby per host keeps abandoned rooms from piling up
  for (const room of rooms.values()) {
    if (room.hostUserId === hostUserId && room.status === 'lobby') closeRoom(room.code, 'host-created-new-room');
  }

  const room = {
    code: makeCode(),
    hostUserId,
    hostPlayerId: null, // set when the host's account joins the room
    topic,
    settings, // { count, difficulty, timePerQuestion }
    questions, // never sent to clients until a question is live
    questionSource: source,
    status: 'lobby', // lobby | active | finished
    players: new Map(),
    graceTimers: new Map(),
    idleTimer: null,
    createdAt: Date.now(),
  };
  rooms.set(room.code, room);
  scheduleIdleExpiry(room);
  return room;
}

export function closeRoom(code, reason) {
  const room = rooms.get(code);
  if (!room) return;
  clearTimeout(room.idleTimer);
  clearTimeout(room.cleanupTimer);
  room.graceTimers.forEach(clearTimeout);
  rooms.delete(code);
  hooks.onClosed(room, reason);
}

// a room nobody is connected to is dropped after a while
function scheduleIdleExpiry(room) {
  clearTimeout(room.idleTimer);
  room.idleTimer = setTimeout(() => closeRoom(room.code, 'idle'), IDLE_ROOM_TTL_MS);
}

function refreshIdleExpiry(room) {
  const anyoneConnected = [...room.players.values()].some((p) => p.connected);
  if (anyoneConnected) clearTimeout(room.idleTimer);
  else scheduleIdleExpiry(room);
}

// true while this account has a seat in a game that is running (used to switch the chatbot off)
export function isUserInActiveGame(userId) {
  for (const room of rooms.values()) {
    if (room.status !== 'active') continue;
    for (const player of room.players.values()) if (player.userId === userId) return true;
  }
  return false;
}

export function publicInfo(room) {
  return {
    code: room.code,
    topic: room.topic,
    status: room.status,
    playerCount: room.players.size,
    maxPlayers: MAX_PLAYERS,
  };
}

export function publicState(room) {
  return {
    code: room.code,
    topic: room.topic,
    status: room.status,
    settings: room.settings,
    hostId: room.hostPlayerId,
    maxPlayers: MAX_PLAYERS,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      connected: p.connected,
      isHost: p.id === room.hostPlayerId,
    })),
  };
}

/**
 * Join, or re-attach to an existing player (reconnect / second tab / refresh).
 * Returns { player } or { error: CODE }.
 */
export function joinRoom(room, { nickname, userId, socketId }) {
  if (!userId) return { error: 'LOGIN_REQUIRED' };

  // A seat belongs to an account. (Matching on a client-sent player id would let anyone take over another
  // player's seat, since player ids are visible to everybody in the room.)
  let player = [...room.players.values()].find((p) => p.userId === userId);

  if (player) {
    clearTimeout(room.graceTimers.get(player.id));
    room.graceTimers.delete(player.id);
    player.socketId = socketId;
    player.connected = true;
  } else {
    if (room.status !== 'lobby') return { error: 'GAME_STARTED' };
    if (room.players.size >= MAX_PLAYERS) return { error: 'ROOM_FULL' };
    const taken = [...room.players.values()].some((p) => p.nickname.toLowerCase() === nickname.toLowerCase());
    if (taken) return { error: 'NICKNAME_TAKEN' };

    player = {
      id: randomUUID(),
      nickname,
      userId: userId ?? null,
      socketId,
      connected: true,
      score: 0,
      correctCount: 0,
      answers: [],
    };
    room.players.set(player.id, player);
    if (userId && userId === room.hostUserId && !room.hostPlayerId) room.hostPlayerId = player.id;
  }

  refreshIdleExpiry(room);
  hooks.onChange(room);
  return { player };
}

function pickNewHost(room) {
  const next = [...room.players.values()].find((p) => p.connected);
  room.hostPlayerId = next ? next.id : null;
}

export function removePlayer(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) return null;
  clearTimeout(room.graceTimers.get(playerId));
  room.graceTimers.delete(playerId);
  room.players.delete(playerId);
  if (room.hostPlayerId === playerId) pickNewHost(room);
  refreshIdleExpiry(room);
  hooks.onChange(room);
  return player;
}

// Connection dropped: keep the seat for a grace period so refreshes and flaky wifi are painless.
export function markDisconnected(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) return;
  player.connected = false;
  player.socketId = null;

  const wasHost = room.hostPlayerId === playerId;
  clearTimeout(room.graceTimers.get(playerId));
  room.graceTimers.set(
    playerId,
    setTimeout(() => {
      room.graceTimers.delete(playerId);
      const p = room.players.get(playerId);
      if (!p || p.connected) return;
      if (room.status === 'lobby') {
        removePlayer(room, playerId); // also hands over hosting if needed
      } else if (wasHost && room.hostPlayerId === playerId) {
        pickNewHost(room);
        hooks.onChange(room);
      }
    }, wasHost ? HOST_GRACE_MS : PLAYER_GRACE_MS)
  );

  refreshIdleExpiry(room);
  hooks.onChange(room);
}
