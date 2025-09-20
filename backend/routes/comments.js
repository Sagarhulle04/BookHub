const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Book = require('../models/Book');
const Notification = require('../models/Notification');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/comments/book/:bookId
// @desc    Get comments for a book
// @access  Public
router.get('/book/:bookId', optionalAuth, async (req, res) => {
  try {
    // Validate bookId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.bookId)) {
      return res.status(400).json({ message: 'Invalid book ID format' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const comments = await Comment.find({
      book: req.params.bookId,
      parentComment: null // Only top-level comments
    })
      .populate('user', 'username profilePicture')
      .populate({
        path: 'replies',
        populate: {
          path: 'user',
          select: 'username profilePicture'
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await Comment.countDocuments({
      book: req.params.bookId,
      parentComment: null
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      comments,
      pagination: {
        currentPage: page,
        totalPages,
        totalComments: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/comments
// @desc    Create a new comment
// @access  Private
router.post('/', auth, [
  body('content')
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters'),
  body('bookId')
    .notEmpty()
    .withMessage('Book ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid book ID format');
      }
      return true;
    })
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, bookId, parentCommentId } = req.body;

    // Validate parentCommentId if provided
    if (parentCommentId && !mongoose.Types.ObjectId.isValid(parentCommentId)) {
      return res.status(400).json({ message: 'Invalid parent comment ID format' });
    }

    // Check if book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Create comment
    const comment = new Comment({
      content,
      book: bookId,
      user: req.user._id,
      parentComment: parentCommentId || null
    });

    await comment.save();

    // If it's a reply, add to parent comment's replies
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment) {
        await parentComment.addReply(comment._id);
      }
    }

    // Populate user info
    await comment.populate('user', 'username profilePicture');

    // Notify uploader about new comment (only if not commenting on own book)
    if (book.uploadedBy && book.uploadedBy.toString() !== req.user._id.toString()) {
      try {
        // Store notification in database
        await Notification.createNotification({
          recipientId: book.uploadedBy,
          senderId: req.user._id,
          type: 'comment',
          message: `${req.user.username} commented on your book "${book.title}"`,
          bookId: bookId,
          commentId: comment._id,
          metadata: {
            commenterUsername: req.user.username
          }
        });

        // Send real-time notification via SSE
        const sseClients = req.app.get('sseClients');
        const payload = JSON.stringify({
          type: 'comment',
          recipientId: book.uploadedBy,
          bookId: bookId,
          commenterId: req.user._id,
          commenterUsername: req.user.username,
          message: `${req.user.username} commented on your book "${book.title}"`,
          createdAt: Date.now()
        });
        for (const client of sseClients) {
          client.write(`event: notification\ndata: ${payload}\n\n`);
        }
      } catch (_) {}
    }

    res.status(201).json({
      message: 'Comment created successfully',
      comment
    });

  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/comments/:id
// @desc    Update a comment
// @access  Private
router.put('/:id', auth, [
  body('content')
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Validate comment ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid comment ID format' });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user owns the comment
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }

    // Update comment
    comment.content = req.body.content;
    comment.isEdited = true;
    comment.editedAt = new Date();

    await comment.save();

    res.json({
      message: 'Comment updated successfully',
      comment
    });

  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/comments/:id
// @desc    Delete a comment
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    // Validate comment ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid comment ID format' });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user owns the comment or is admin
    if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // If it's a top-level comment, also delete all replies
    if (!comment.parentComment) {
      await Comment.deleteMany({ parentComment: comment._id });
    } else {
      // If it's a reply, remove from parent's replies array
      const parentComment = await Comment.findById(comment.parentComment);
      if (parentComment) {
        parentComment.replies = parentComment.replies.filter(
          replyId => replyId.toString() !== comment._id.toString()
        );
        await parentComment.save();
      }
    }

    await Comment.findByIdAndDelete(comment._id);

    res.json({ message: 'Comment deleted successfully' });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/comments/:id/like
// @desc    Like/unlike a comment
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    // Validate comment ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid comment ID format' });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const isLiked = comment.likes.includes(req.user._id);

    if (isLiked) {
      await comment.removeLike(req.user._id);
      res.json({ message: 'Comment unliked', liked: false });
    } else {
      await comment.addLike(req.user._id);
      res.json({ message: 'Comment liked', liked: true });
    }

  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/comments/user/:userId
// @desc    Get comments by a specific user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    // Validate userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const comments = await Comment.find({
      user: req.params.userId,
      parentComment: null
    })
      .populate('book', 'title thumbnail')
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await Comment.countDocuments({
      user: req.params.userId,
      parentComment: null
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      comments,
      pagination: {
        currentPage: page,
        totalPages,
        totalComments: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('Get user comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

