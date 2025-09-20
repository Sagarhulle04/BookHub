const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  status: { type: mongoose.Schema.Types.ObjectId, ref: 'Status' },
  taggedStatus: { type: mongoose.Schema.Types.ObjectId, ref: 'Status' }, // For messages about tagged statuses
  // Deletion metadata
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, {
  timestamps: true
});

messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);


