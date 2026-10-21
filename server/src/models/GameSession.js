import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    qIndex: Number,
    choice: { type: Number, default: null }, // null = no answer in time
    correct: Boolean,
    points: Number,
    ms: { type: Number, default: null },
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null for guests
    nickname: String,
    score: Number,
    correctCount: Number,
    rank: Number,
    answers: [answerSchema],
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    text: String,
    options: [String],
    correctIndex: Number,
    explanation: String,
  },
  { _id: false }
);

// One finished game. Written once, when the final leaderboard is known.
const gameSessionSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true },
    hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic: String,
    settings: { count: Number, difficulty: String, timePerQuestion: Number },
    questions: [questionSchema],
    players: [playerSchema],
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true }
);

gameSessionSchema.index({ 'players.userId': 1, endedAt: -1 });
gameSessionSchema.index({ hostUserId: 1, endedAt: -1 });

export const GameSession = mongoose.model('GameSession', gameSessionSchema);
