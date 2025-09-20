const express = require('express');
const { body, validationResult } = require('express-validator');
const UserPreferences = require('../models/UserPreferences');
const { auth } = require('../middleware/auth');
const categoryDetection = require('../services/categoryDetection');

const router = express.Router();

// @route   GET /api/user-preferences
// @desc    Get user preferences
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let preferences = await UserPreferences.findOne({ user: req.user._id });
    
    if (!preferences) {
      // Create default preferences if none exist
      preferences = new UserPreferences({
        user: req.user._id,
        preferredCategories: [],
        favoriteAuthors: [],
        readingLevel: 'Intermediate',
        preferredLanguages: ['English'],
        readingGoals: [],
        timePreferences: 'Any Time',
        bookLengthPreference: 'Any Length',
        isOnboardingCompleted: false
      });
      await preferences.save();
    }

    res.json(preferences);
  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/user-preferences/onboarding
// @desc    Complete user onboarding with preferences
// @access  Private
router.post('/onboarding', [
  auth,
  body('preferredCategories').isArray().withMessage('Preferred categories must be an array'),
  body('readingLevel').optional().isIn(['Beginner', 'Intermediate', 'Advanced', 'Expert']),
  body('readingGoals').optional().isArray(),
  body('timePreferences').optional().isIn(['Morning', 'Afternoon', 'Evening', 'Night', 'Any Time']),
  body('bookLengthPreference').optional().isIn(['Short (1-200 pages)', 'Medium (200-400 pages)', 'Long (400+ pages)', 'Any Length'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      preferredCategories,
      readingLevel = 'Intermediate',
      readingGoals = [],
      timePreferences = 'Any Time',
      bookLengthPreference = 'Any Length'
    } = req.body;

    // Get category recommendations based on selected categories
    const recommendedCategories = categoryDetection.getCategoryRecommendations(preferredCategories);

    let preferences = await UserPreferences.findOne({ user: req.user._id });
    
    if (preferences) {
      // Update existing preferences
      preferences.preferredCategories = preferredCategories;
      preferences.readingLevel = readingLevel;
      preferences.readingGoals = readingGoals;
      preferences.timePreferences = timePreferences;
      preferences.bookLengthPreference = bookLengthPreference;
      preferences.isOnboardingCompleted = true;
      preferences.lastUpdated = new Date();
    } else {
      // Create new preferences
      preferences = new UserPreferences({
        user: req.user._id,
        preferredCategories,
        readingLevel,
        readingGoals,
        timePreferences,
        bookLengthPreference,
        isOnboardingCompleted: true
      });
    }

    await preferences.save();

    res.json({
      message: 'Onboarding completed successfully!',
      preferences,
      recommendedCategories
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/user-preferences
// @desc    Update user preferences
// @access  Private
router.put('/', [
  auth,
  body('preferredCategories').optional().isArray(),
  body('favoriteAuthors').optional().isArray(),
  body('readingLevel').optional().isIn(['Beginner', 'Intermediate', 'Advanced', 'Expert']),
  body('readingGoals').optional().isArray(),
  body('timePreferences').optional().isIn(['Morning', 'Afternoon', 'Evening', 'Night', 'Any Time']),
  body('bookLengthPreference').optional().isIn(['Short (1-200 pages)', 'Medium (200-400 pages)', 'Long (400+ pages)', 'Any Length'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = { ...req.body };
    updateData.lastUpdated = new Date();

    const preferences = await UserPreferences.findOneAndUpdate(
      { user: req.user._id },
      updateData,
      { new: true, upsert: true }
    );

    res.json({
      message: 'Preferences updated successfully!',
      preferences
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/user-preferences/recommendations
// @desc    Get personalized book recommendations based on preferences
// @access  Private
router.get('/recommendations', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const preferences = await UserPreferences.findOne({ user: req.user._id });
    
    if (!preferences || !preferences.isOnboardingCompleted) {
      return res.status(400).json({ 
        message: 'Please complete onboarding first',
        needsOnboarding: true 
      });
    }

    // Get books based on user preferences
    const Book = require('../models/Book');
    const Like = require('../models/Like');
    const Bookmark = require('../models/Bookmark');

    // Get user's interaction history
    const [likedBooks, bookmarkedBooks] = await Promise.all([
      Like.find({ user: req.user._id }).populate('book').lean(),
      Bookmark.find({ user: req.user._id }).populate('book').lean()
    ]);

    const interactedBookIds = [
      ...likedBooks.map(l => l.book?._id).filter(Boolean),
      ...bookmarkedBooks.map(b => b.book?._id).filter(Boolean)
    ];

    // Build recommendation query
    const query = {
      status: 'published',
      isApproved: true,
      isGlobal: true,
      uploadedBy: { $ne: req.user._id },
      _id: { $nin: interactedBookIds }
    };

    // Add category filter if user has preferences
    if (preferences.preferredCategories.length > 0) {
      query.category = { $in: preferences.preferredCategories };
    }

    // Add author filter if user has favorite authors
    if (preferences.favoriteAuthors.length > 0) {
      query.author = { $in: preferences.favoriteAuthors };
    }

    const recommendations = await Book.find(query)
      .populate('uploadedBy', 'username profilePicture followers')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // If not enough recommendations, fill with popular books
    if (recommendations.length < limit) {
      const additionalQuery = {
        status: 'published',
        isApproved: true,
        isGlobal: true,
        uploadedBy: { $ne: req.user._id },
        _id: { $nin: [...interactedBookIds, ...recommendations.map(b => b._id)] }
      };

      const additionalBooks = await Book.find(additionalQuery)
        .populate('uploadedBy', 'username profilePicture followers')
        .sort({ viewCount: -1, createdAt: -1 })
        .limit(limit - recommendations.length)
        .lean();

      recommendations.push(...additionalBooks);
    }

    res.json({
      recommendations,
      preferences: {
        preferredCategories: preferences.preferredCategories,
        readingLevel: preferences.readingLevel,
        readingGoals: preferences.readingGoals
      }
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/user-preferences/categories
// @desc    Get available categories for onboarding
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = categoryDetection.getPopularCategories();
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
