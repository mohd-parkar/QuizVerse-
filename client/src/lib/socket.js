import { io } from 'socket.io-client';
import { getAuthToken } from './api.js';

// same-origin in dev (Vite proxies /socket.io); set VITE_SERVER_URL when the API is hosted elsewhere
export const socket = io(import.meta.env.VITE_SERVER_URL || undefined, {
  autoConnect: false,
  withCredentials: true,
  auth: (cb) => {
    cb({ token: getAuthToken() });
  },
});
