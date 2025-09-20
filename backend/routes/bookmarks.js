const express = require('express');
const { body, validationResult } = require('express-validator');
const Bookmark = require('../models/Bookmark');
const Book = require('../models/Book');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/bookmarks/:bookId
// @desc    Bookmark/unbookmark a book
// @access  Private
router.post('/:bookId', auth, [
  body('folder').optional().isLength({ max: 50 }).withMessage('Folder name cannot exceed 50 characters'),
  body('note').optional().isLength({ max: 500 }).withMessage('Note cannot exceed 500 characters')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const bookId = req.params.bookId;
    const { folder, note } = req.body;

    // Check if book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if already bookmarked
    const existingBookmark = await Bookmark.findOne({
      user: req.user._id,
      book: bookId
    });

    if (existingBookmark) {
      // Remove bookmark - don't send notification for unbookmarks
      await Bookmark.findByIdAndDelete(existingBookmark._id);
      res.json({ message: 'Book unbookmarked', bookmarked: false });
    } else {
      // Add bookmark
      const bookmark = new Bookmark({
        user: req.user._id,
        book: bookId,
        folder: folder || 'General',
        note: note || ''
      });
      await bookmark.save();
      
      // Only send notification to the book owner, not the person who bookmarked
      if (book.uploadedBy && book.uploadedBy.toString() !== req.user._id.toString()) {
        try {
          // Store notification in database
          await Notification.createNotification({
            recipientId: book.uploadedBy,
            senderId: req.user._id,
            type: 'book_bookmarked',
            message: `${req.user.username} bookmarked your book "${book.title}"`,
            bookId: bookId,
            metadata: {
              bookmarkerUsername: req.user.username
            }
          });

          // Send real-time notification via SSE
          const sseClients = req.app.get('sseClients');
          const payload = JSON.stringify({
            type: 'book_bookmarked',
            recipientId: book.uploadedBy,
            bookmarkerId: req.user._id,
            bookmarkerUsername: req.user.username,
            message: `${req.user.username} bookmarked your book "${book.title}"`,
            createdAt: Date.now(),
            bookId: bookId
          });
          for (const client of sseClients) {
            client.write(`event: notification\ndata: ${payload}\n\n`);
          }
        } catch (_) {}
      }
      res.json({ message: 'Book bookmarked', bookmarked: true });
    }

  } catch (error) {
    console.error('Bookmark/unbookmark error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/bookmarks/:bookId
// @desc    Update bookmark details
// @access  Private
router.put('/:bookId', auth, [
  body('folder').optional().isLength({ max: 50 }).withMessage('Folder name cannot exceed 50 characters'),
  body('note').optional().isLength({ max: 500 }).withMessage('Note cannot exceed 500 characters')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { folder, note } = req.body;

    const bookmark = await Bookmark.findOne({
      user: req.user._id,
      book: req.params.bookId
    });

    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }

    if (folder !== undefined) bookmark.folder = folder;
    if (note !== undefined) bookmark.note = note;

    await bookmark.save();

    res.json({
      message: 'Bookmark updated successfully',
      bookmark
    });

  } catch (error) {
    console.error('Update bookmark error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bookmarks/book/:bookId
// @desc    Check if user bookmarked a book
// @access  Private
router.get('/book/:bookId', auth, async (req, res) => {
  try {
    const bookmark = await Bookmark.findOne({
      user: req.user._id,
      book: req.params.bookId
    });

    res.json({ 
      bookmarked: !!bookmark,
      bookmark: bookmark || null
    });
  } catch (error) {
    console.error('Check bookmark error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bookmarks/user/:userId
// @desc    Get books bookmarked by a user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const folder = req.query.folder;

    let query = { user: req.params.userId };
    if (folder && folder !== 'all') {
      query.folder = folder;
    }

    const bookmarks = await Bookmark.find(query)
      .populate({
        path: 'book',
        select: 'title author thumbnail summary category viewCount',
        populate: {
          path: 'uploadedBy',
          select: 'username profilePicture'
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await Bookmark.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Extract books from bookmarks
    const books = bookmarks.map(bookmark => ({
      ...bookmark.book,
      bookmarkId: bookmark._id,
      folder: bookmark.folder,
      note: bookmark.note,
      bookmarkedAt: bookmark.createdAt
    })).filter(book => book.title);

    res.json({
      books,
      pagination: {
        currentPage: page,
        totalPages,
        totalBooks: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('Get user bookmarks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bookmarks/folders/:userId
// @desc    Get bookmark folders for a user
// @access  Public
router.get('/folders/:userId', async (req, res) => {
  try {
    const folders = await Bookmark.aggregate([
      { $match: { user: req.params.userId } },
      { $group: { _id: '$folder', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json(folders);
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bookmarks/book/:bookId/count
// @desc    Get bookmark count for a book
// @access  Public
router.get('/book/:bookId/count', async (req, res) => {
  try {
    const count = await Bookmark.countDocuments({ book: req.params.bookId });
    res.json({ count });
  } catch (error) {
    console.error('Get bookmark count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

