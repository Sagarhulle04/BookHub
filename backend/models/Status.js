const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mediaUrl: { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
  caption: { type: String },
  text: { type: String }, // Text overlay on the status
  taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users tagged in the status
  emojis: [{ type: Object }], // Emojis added to the status
  expiresAt: { type: Date, required: true },
  views: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, {
  timestamps: true
});

statusSchema.index({ user: 1, createdAt: -1 });
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Status', statusSchema);


