const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  folder: {
    type: String,
    default: 'General',
    trim: true,
    maxlength: [50, 'Folder name cannot exceed 50 characters']
  },
  note: {
    type: String,
    maxlength: [500, 'Note cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Compound index to ensure one bookmark per user per book
bookmarkSchema.index({ user: 1, book: 1 }, { unique: true });

// Index for efficient queries
bookmarkSchema.index({ book: 1, createdAt: -1 });
bookmarkSchema.index({ folder: 1, user: 1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);

