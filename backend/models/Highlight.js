const mongoose = require('mongoose');

const highlightSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  pageNumber: { type: Number, required: true },
  text: { type: String, required: true },
  note: { type: String },
}, { timestamps: true });

highlightSchema.index({ user: 1, book: 1, createdAt: -1 });

module.exports = mongoose.model('Highlight', highlightSchema);


