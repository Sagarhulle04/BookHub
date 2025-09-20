const express = require('express');
const Like = require('../models/Like');
const Book = require('../models/Book');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/likes/:bookId
// @desc    Like/unlike a book
// @access  Private
router.post('/:bookId', auth, async (req, res) => {
  try {
    const bookId = req.params.bookId;

    // Check if book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if already liked
    const existingLike = await Like.findOne({
      user: req.user._id,
      book: bookId
    });

    if (existingLike) {
      // Unlike - don't send notification for unlikes
      await Like.findByIdAndDelete(existingLike._id);
      res.json({ message: 'Book unliked', liked: false });
    } else {
      // Like
      const like = new Like({
        user: req.user._id,
        book: bookId
      });
      await like.save();
      
      // Only send notification to the book owner, not the person who liked
      if (book.uploadedBy && book.uploadedBy.toString() !== req.user._id.toString()) {
        try {
          // Store notification in database
          await Notification.createNotification({
            recipientId: book.uploadedBy,
            senderId: req.user._id,
            type: 'book_liked',
            message: `${req.user.username} liked your book "${book.title}"`,
            bookId: bookId,
            metadata: {
              likerUsername: req.user.username
            }
          });

          // Send real-time notification via SSE
          const sseClients = req.app.get('sseClients');
          const payload = JSON.stringify({
            type: 'book_liked',
            recipientId: book.uploadedBy,
            likerId: req.user._id,
            likerUsername: req.user.username,
            message: `${req.user.username} liked your book "${book.title}"`,
            createdAt: Date.now(),
            bookId: bookId
          });
          for (const client of sseClients) {
            client.write(`event: notification\ndata: ${payload}\n\n`);
          }
        } catch (_) {}
      }
      res.json({ message: 'Book liked', liked: true });
    }

  } catch (error) {
    console.error('Like/unlike error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/likes/book/:bookId
// @desc    Check if user liked a book
// @access  Private
router.get('/book/:bookId', auth, async (req, res) => {
  try {
    const like = await Like.findOne({
      user: req.user._id,
      book: req.params.bookId
    });

    res.json({ liked: !!like });
  } catch (error) {
    console.error('Check like error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/likes/user/:userId
// @desc    Get books liked by a user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    const likes = await Like.find({ user: req.params.userId })
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

    const total = await Like.countDocuments({ user: req.params.userId });
    const totalPages = Math.ceil(total / limit);

    // Extract books from likes
    const books = likes.map(like => like.book).filter(book => book);

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
    console.error('Get user likes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/likes/book/:bookId/count
// @desc    Get like count for a book
// @access  Public
router.get('/book/:bookId/count', async (req, res) => {
  try {
    const count = await Like.countDocuments({ book: req.params.bookId });
    res.json({ count });
  } catch (error) {
    console.error('Get like count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

