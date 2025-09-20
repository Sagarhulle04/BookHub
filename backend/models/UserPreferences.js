const mongoose = require("mongoose");

const userPreferencesSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    preferredCategories: [
      {
        type: String,
        enum: [
          "Fiction",
          "Non-Fiction",
          "Mystery",
          "Romance",
          "Science Fiction",
          "Fantasy",
          "Thriller",
          "Biography",
          "History",
          "Self-Help",
          "Business",
          "Technology",
          "Health",
          "Psychology",
          "Philosophy",
          "Religion",
          "Art",
          "Music",
          "Travel",
          "Cooking",
          "Sports",
          "Education",
          "Science",
          "Mathematics",
          "Poetry",
          "Drama",
          "Comedy",
          "Horror",
          "Adventure",
          "Children",
          "Young Adult",
        ],
      },
    ],
    favoriteAuthors: [
      {
        type: String,
        trim: true,
      },
    ],
    readingLevel: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
      default: "Intermediate",
    },
    preferredLanguages: [
      {
        type: String,
        default: "English",
      },
    ],
    readingGoals: [
      {
        type: String,
        enum: [
          "Entertainment",
          "Education",
          "Professional Development",
          "Personal Growth",
          "Research",
        ],
      },
    ],
    timePreferences: {
      type: String,
      enum: ["Morning", "Afternoon", "Evening", "Night", "Any Time"],
      default: "Any Time",
    },
    bookLengthPreference: {
      type: String,
      enum: [
        "Short (1-200 pages)",
        "Medium (200-400 pages)",
        "Long (400+ pages)",
        "Any Length",
      ],
      default: "Any Length",
    },
    isOnboardingCompleted: {
      type: Boolean,
      default: false,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
userPreferencesSchema.index({ preferredCategories: 1 });

module.exports = mongoose.model("UserPreferences", userPreferencesSchema);
