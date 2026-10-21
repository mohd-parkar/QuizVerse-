import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb() {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.');
  }
  await mongoose.connect(env.mongoUri);
  console.log('MongoDB connected');
}
