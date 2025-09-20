const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  }
}, {
  timestamps: true
});

// Compound index to ensure one like per user per book
likeSchema.index({ user: 1, book: 1 }, { unique: true });

// Index for efficient queries
likeSchema.index({ book: 1, createdAt: -1 });

module.exports = mongoose.model('Like', likeSchema);

