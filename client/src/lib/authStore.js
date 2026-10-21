import { create } from 'zustand';
import { api } from './api.js';
import { socket } from './socket.js';
import { useRoom } from './roomStore.js';

export const useAuth = create((set) => ({
  user: null,
  loading: true,

  async init() {
    try {
      const { user } = await api.get('/auth/me');
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  async login(email, password) {
    const { user } = await api.post('/auth/login', { email, password });
    set({ user });
  },

  async register(username, email, password) {
    const { user } = await api.post('/auth/register', { username, email, password });
    set({ user });
  },

  // `credential` is the ID token the Sign in with Google button hands back; the server verifies it
  async googleLogin(credential) {
    const { user } = await api.post('/auth/google', { credential });
    set({ user });
  },

  async logout() {
    // drop the seat and the live connection first: the socket is tied to the account it connected with
    useRoom.getState().leave();
    socket.disconnect();
    await api.post('/auth/logout');
    set({ user: null });
  },
}));
