const express = require('express');
const { auth } = require('../middleware/auth');
const Highlight = require('../models/Highlight');

const router = express.Router();

// Create highlight
router.post('/', auth, async (req, res) => {
  try {
    const { bookId, pageNumber, text, note } = req.body;
    if (!bookId || !pageNumber || !text) return res.status(400).json({ message: 'Missing fields' });
    const hl = new Highlight({ user: req.user._id, book: bookId, pageNumber, text, note });
    await hl.save();
    res.status(201).json(hl);
  } catch (e) {
    console.error('Create highlight error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// List highlights by book for current user
router.get('/book/:bookId', auth, async (req, res) => {
  try {
    const items = await Highlight.find({ user: req.user._id, book: req.params.bookId }).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (e) {
    console.error('List highlights error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete highlight
router.delete('/:id', auth, async (req, res) => {
  try {
    const hl = await Highlight.findById(req.params.id);
    if (!hl) return res.status(404).json({ message: 'Not found' });
    if (hl.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    await hl.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('Delete highlight error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Summarize highlights (heuristic placeholder)
router.get('/book/:bookId/summary', auth, async (req, res) => {
  try {
    const items = await Highlight.find({ user: req.user._id, book: req.params.bookId }).sort({ createdAt: 1 }).lean();
    const summary = items.map((h, i) => `${i + 1}. ${h.text}`).join('\n');
    res.json({ summary });
  } catch (e) {
    console.error('Summarize highlights error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


