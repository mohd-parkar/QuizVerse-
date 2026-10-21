import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 24 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // absent for accounts created with Google; those sign in with Google only
    passwordHash: { type: String },
    // Google's stable user id ("sub"); sparse so password-only accounts do not collide on a missing value
    googleId: { type: String, unique: true, sparse: true },
    picture: { type: String },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return { id: this._id.toString(), username: this.username, email: this.email, picture: this.picture ?? null };
};

export const User = mongoose.model('User', userSchema);
