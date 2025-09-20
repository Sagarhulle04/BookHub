const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const Book = require('../models/Book');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const cloudinary = require('../utils/cloudinary');

const router = express.Router();
// @route   GET /api/users/search
// @desc    Search users by username or full name (public)
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!q) {
      return res.json({ users: [], pagination: { currentPage: 1, totalPages: 0, totalUsers: 0, hasNext: false, hasPrev: false, limit } });
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const filter = {
      $or: [
        { username: { $regex: regex } },
        { fullName: { $regex: regex } },
      ]
    };

    const users = await User.find(filter)
      .select('_id username fullName profilePicture')
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    return res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit
      }
    });
  } catch (e) {
    console.error('User search error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('followers', 'username profilePicture')
      .populate('following', 'username profilePicture');

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/debug
// @desc    Debug endpoint to check authentication
// @access  Private
router.get('/debug', auth, async (req, res) => {
  try {
    res.json({
      message: 'Authentication working',
      userId: req.user._id,
      username: req.user.username,
      hasToken: !!req.cookies.token
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/me/ping
// @desc    Heartbeat to update lastActive for online presence
// @access  Private
router.post('/me/ping', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { lastActive: new Date() });
    res.json({ ok: true });
  } catch (e) {
    console.error('Presence ping error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [auth, uploadImage], [
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Full name can only contain letters and spaces'),
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, username, bio } = req.body;
    const updates = {};

    // Handle fullName update
    if (fullName !== undefined) {
      updates.fullName = fullName;
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== req.user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updates.username = username;
    }

    if (bio !== undefined) {
      updates.bio = bio;
    }

    // Handle profile picture upload
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'bookhub/profiles',
        transformation: [{ width: 200, height: 200, crop: 'fill' }]
      });
      updates.profilePicture = result.secure_url;
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:username
// @desc    Get user profile by username
// @access  Public
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password')
      .populate('followers', 'username profilePicture')
      .populate('following', 'username profilePicture');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/follow/:userId
// @desc    Follow a user
// @access  Private
router.post('/follow/:userId', auth, async (req, res) => {
  try {
    console.log('=== FOLLOW REQUEST START ===');
    console.log('Follow request:', {
      currentUserId: req.user._id,
      targetUserId: req.params.userId,
      currentUserFollowing: req.user.following,
      requestUrl: req.url,
      requestMethod: req.method,
      hasToken: !!req.cookies.token
    });
    console.log('=== FOLLOW REQUEST END ===');

    if (req.params.userId === req.user._id.toString()) {
      console.log('❌ ERROR: User trying to follow themselves');
      console.log('Current user ID:', req.user._id);
      console.log('Target user ID:', req.params.userId);
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const userToFollow = await User.findById(req.params.userId);
    if (!userToFollow) {
      console.log('User not found:', req.params.userId);
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = await User.findById(req.user._id);

    // Check if already following - convert to string for comparison
    const isAlreadyFollowing = currentUser.following.some(followingId => 
      followingId.toString() === req.params.userId
    );
    if (isAlreadyFollowing) {
      console.log('❌ ERROR: Already following this user');
      console.log('Current user following list:', currentUser.following);
      console.log('Target user ID:', req.params.userId);
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Add to following
    currentUser.following.push(req.params.userId);
    await currentUser.save();

    // Add to followers
    userToFollow.followers.push(req.user._id);
    await userToFollow.save();

    // Notify the recipient via SSE and store in database
    try {
      // Store notification in database
      await Notification.createNotification({
        recipientId: userToFollow._id,
        senderId: req.user._id,
        type: 'follow',
        message: `${req.user.username} started following you`,
        metadata: {
          followerUsername: req.user.username
        }
      });

      // Send real-time notification via SSE
      const sseClients = req.app.get('sseClients');
      const payload = JSON.stringify({
        type: 'follow',
        recipientId: userToFollow._id,
        followerId: req.user._id,
        followerUsername: req.user.username,
        message: `${req.user.username} started following you`,
        createdAt: Date.now()
      });
      for (const client of sseClients) {
        client.write(`event: follow\ndata: ${payload}\n\n`);
      }
    } catch (notificationError) {
      console.error('Notification creation failed:', notificationError);
      // Don't fail the follow operation if notification fails
    }

    res.json({ message: 'User followed successfully' });

  } catch (error) {
    console.error('Follow user error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/unfollow/:userId
// @desc    Unfollow a user
// @access  Private
router.post('/unfollow/:userId', auth, async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.userId);
    if (!userToUnfollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = await User.findById(req.user._id);

    // Check if following - convert to string for comparison
    const isFollowing = currentUser.following.some(followingId => 
      followingId.toString() === req.params.userId
    );
    if (!isFollowing) {
      return res.status(400).json({ message: 'Not following this user' });
    }

    // Remove from following
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== req.params.userId
    );
    await currentUser.save();

    // Remove from followers
    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== req.user._id.toString()
    );
    await userToUnfollow.save();

    // Notify the recipient that a user unfollowed (optional)
    try {
      const sseClients = req.app.get('sseClients');
      const payload = JSON.stringify({
        type: 'unfollow',
        recipientId: userToUnfollow._id,
        followerId: req.user._id,
        followerUsername: req.user.username,
        message: `${req.user.username} unfollowed you`,
        createdAt: Date.now()
      });
      for (const client of sseClients) {
        client.write(`event: notification\ndata: ${payload}\n\n`);
      }
    } catch (_) {}

    res.json({ message: 'User unfollowed successfully' });

  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/me/favorite-categories
// @desc    Update current user's favorite categories
// @access  Private
router.put('/me/favorite-categories', auth, async (req, res) => {
  try {
    let { categories } = req.body;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ message: 'Categories must be an array of strings' });
    }
    // Normalize: trim, filter non-empty strings, unique, cap at 20
    categories = Array.from(new Set(categories
      .map(c => (typeof c === 'string' ? c.trim() : ''))
      .filter(Boolean)
    )).slice(0, 20);

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.favoriteCategories = categories;
    await user.save();

    res.json({ message: 'Favorite categories updated', favoriteCategories: user.favoriteCategories });
  } catch (error) {
    console.error('Update favorite categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:username/books
// @desc    Get books uploaded by a user
// @access  Public
router.get('/:username/books', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    const books = await Book.find({
      uploadedBy: user._id,
      status: 'published',
      isApproved: true
    })
      .populate('uploadedBy', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await Book.countDocuments({
      uploadedBy: user._id,
      status: 'published',
      isApproved: true
    });

    const totalPages = Math.ceil(total / limit);

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
    console.error('Get user books error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:userId/following
// @desc    Get users that a specific user is following
// @access  Public
router.get('/:userId/following', async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId).select('following');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followingIds = user.following || [];
    const total = followingIds.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageFollowingIds = followingIds.slice(startIndex, endIndex);

    const following = await User.find({ _id: { $in: pageFollowingIds } })
      .select('_id username profilePicture bio')
      .lean();

    res.json({
      following,
      pagination: {
        currentPage: page,
        totalPages,
        totalFollowing: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit
      }
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:userId/followers
// @desc    Get users that follow a specific user
// @access  Public
router.get('/:userId/followers', async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId).select('followers');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followerIds = user.followers || [];
    const total = followerIds.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageFollowerIds = followerIds.slice(startIndex, endIndex);

    const followers = await User.find({ _id: { $in: pageFollowerIds } })
      .select('_id username profilePicture bio')
      .lean();

    res.json({
      followers,
      pagination: {
        currentPage: page,
        totalPages,
        totalFollowers: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit
      }
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/suggestions
// @desc    Follow suggestions based on interests/behavior (heuristic v1)
// @access  Private
router.get('/suggestions', auth, async (req, res) => {
  try {
    // Exclude myself, already-followed, and optionally followers
    const me = await User.findById(req.user._id).select('following');
    const excludeIds = new Set([req.user._id.toString(), ...(me.following || []).map(String)]);

    // Heuristics: users who uploaded popular books and are followed by people you follow
    const Book = require('../models/Book');

    const popularUploaders = await Book.aggregate([
      { $match: { status: 'published', isApproved: true } },
      { $group: { _id: '$uploadedBy', views: { $sum: '$viewCount' }, count: { $sum: 1 } } },
      { $sort: { views: -1, count: -1 } },
      { $limit: 100 }
    ]);

    const candidatesMap = new Map();
    for (const u of popularUploaders) {
      if (!u._id) continue;
      if (excludeIds.has(u._id.toString())) continue;
      candidatesMap.set(u._id.toString(), { userId: u._id, score: (u.views || 0) + (u.count || 0) * 5 });
    }

    // Boost if followed-by the people I follow (second-degree)
    const secondDegree = await User.find({ followers: { $in: me.following || [] } }).select('_id followers');
    for (const u of secondDegree) {
      if (excludeIds.has(u._id.toString())) continue;
      const entry = candidatesMap.get(u._id.toString()) || { userId: u._id, score: 0 };
      entry.score += Math.min((u.followers?.length || 0), 50) * 2;
      candidatesMap.set(u._id.toString(), entry);
    }

    // Pull user profiles and return top N
    const top = Array.from(candidatesMap.values()).sort((a, b) => b.score - a.score).slice(0, 20);
    const users = await User.find({ _id: { $in: top.map(t => t.userId) } }).select('_id username profilePicture bio');

    // Order by score
    const scoreById = new Map(top.map(t => [t.userId.toString(), t.score]));
    const ordered = users.sort((a, b) => (scoreById.get(b._id.toString()) || 0) - (scoreById.get(a._id.toString()) || 0));

    res.json(ordered);
  } catch (e) {
    console.error('Follow suggestions error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

