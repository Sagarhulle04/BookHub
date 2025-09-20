const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: {
    text: { type: String },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date }
  },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Tracks when each participant last marked the conversation as read
  lastReadAtBy: { type: Map, of: Date, default: {} }
}, {
  timestamps: true
});

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);


