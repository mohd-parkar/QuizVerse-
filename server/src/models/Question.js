import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    topicKey: { type: String, required: true, index: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    text: { type: String, required: true },
    textHash: { type: String, required: true },
    options: { type: [String], validate: (v) => v.length === 4 },
    correctIndex: { type: Number, min: 0, max: 3, required: true },
    explanation: { type: String, default: '' },
    source: { type: String, enum: ['ai', 'manual'], default: 'ai' },
  },
  { timestamps: true }
);

// the same question text is never cached twice for a topic + difficulty
questionSchema.index({ topicKey: 1, difficulty: 1, textHash: 1 }, { unique: true });

export const Question = mongoose.model('Question', questionSchema);
