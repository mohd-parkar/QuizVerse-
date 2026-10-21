import { parseCookie } from 'cookie';
import { z } from 'zod';
import { COOKIE_NAME, userFromToken } from '../middleware/auth.js';
import {
  getRoom,
  joinRoom,
  markDisconnected,
  publicState,
  removePlayer,
  setRoomHooks,
} from './roomManager.js';
import { gameSnapshot, initGame, startGame, stopGame, submitAnswer } from './gameLoop.js';

// players are always their account: the display name is the username, never typed in
const joinSchema = z.object({
  code: z.string().trim().length(6),
  playerId: z.string().max(64).optional(),
});

const fail = (ack, error) => typeof ack === 'function' && ack({ ok: false, error });

export function registerSockets(io) {
  initGame(io);
  setRoomHooks({
    onChange: (room) => io.to(room.code).emit('room:state', publicState(room)),
    onClosed: (room, reason) => {
      stopGame(room);
      io.to(room.code).emit('room:closed', { reason });
      io.in(room.code).socketsLeave(room.code);
    },
  });

  // Only signed-in users can connect at all. The account comes from the same httpOnly cookie the REST API uses.
  io.use(async (socket, next) => {
    const cookies = parseCookie(socket.handshake.headers.cookie || '');
    const user = await userFromToken(cookies[COOKIE_NAME]);
    if (!user) return next(new Error('LOGIN_REQUIRED'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const current = () => {
      const room = getRoom(socket.data.roomCode ?? '');
      const player = room?.players.get(socket.data.playerId);
      return room && player ? { room, player } : {};
    };

    function detach() {
      const { room, player } = current();
      socket.leave(socket.data.roomCode);
      socket.data.roomCode = null;
      socket.data.playerId = null;
      return { room, player };
    }

    socket.on('room:join', (payload, ack) => {
      const parsed = joinSchema.safeParse(payload);
      if (!parsed.success) return fail(ack, 'INVALID_INPUT');

      const room = getRoom(parsed.data.code);
      if (!room) return fail(ack, 'ROOM_NOT_FOUND');

      // switching rooms on one socket: leave the old one first
      if (socket.data.roomCode && socket.data.roomCode !== room.code) {
        const { room: old, player } = detach();
        if (old && player) old.status === 'lobby' ? removePlayer(old, player.id) : markDisconnected(old, player.id);
      }

      const result = joinRoom(room, {
        nickname: socket.data.user.username,
        userId: socket.data.user.id,
        playerId: parsed.data.playerId,
        socketId: socket.id,
      });
      if (result.error) return fail(ack, result.error);

      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.playerId = result.player.id;
      ack?.({
        ok: true,
        playerId: result.player.id,
        state: publicState(room),
        game: gameSnapshot(room, result.player.id), // non-null when (re)joining a game in progress
      });
    });

    socket.on('room:leave', () => {
      const { room, player } = detach();
      if (!room || !player) return;
      if (room.status === 'lobby') removePlayer(room, player.id);
      else markDisconnected(room, player.id);
    });

    socket.on('room:kick', ({ playerId } = {}) => {
      const { room, player } = current();
      if (!room || room.status !== 'lobby' || room.hostPlayerId !== player.id) return;
      if (playerId === player.id) return;
      const target = removePlayer(room, playerId);
      if (target?.socketId) {
        io.to(target.socketId).emit('room:kicked');
        io.in(target.socketId).socketsLeave(room.code);
      }
    });

    socket.on('game:start', (_payload, ack) => {
      const { room, player } = current();
      if (!room) return fail(ack, 'NOT_IN_ROOM');
      if (room.hostPlayerId !== player.id) return fail(ack, 'NOT_HOST');
      if (room.status !== 'lobby') return fail(ack, 'ALREADY_STARTED');

      startGame(room);
      ack?.({ ok: true });
    });

    socket.on('answer:submit', (payload, ack) => {
      const { room, player } = current();
      if (!room) return fail(ack, 'NOT_IN_ROOM');
      const error = submitAnswer(room, player, payload);
      if (error) return fail(ack, error);
      ack?.({ ok: true });
    });

    socket.on('disconnect', () => {
      const { room, player } = current();
      if (room && player) markDisconnected(room, player.id);
    });
  });
}
