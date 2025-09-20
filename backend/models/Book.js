const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Book title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  author: {
    type: String,
    required: [true, 'Author name is required'],
    trim: true,
    maxlength: [100, 'Author name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Science Fiction', 
      'Fantasy', 'Thriller', 'Biography', 'History', 'Self-Help', 'Business', 
      'Technology', 'Health', 'Psychology', 'Philosophy', 'Religion', 'Art', 
      'Music', 'Travel', 'Cooking', 'Sports', 'Education', 'Science', 
      'Mathematics', 'Poetry', 'Drama', 'Comedy', 'Horror', 'Adventure', 
      'Children', 'Young Adult', 'Other'
    ]
  },
  categoryConfidence: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1
  },
  analysisMethod: {
    type: String,
    enum: ['title_description', 'pdf_analysis', 'advanced_pattern', 'manual', 'error'],
    default: 'title_description'
  },
  summary: {
    type: String,
    required: [true, 'Book summary is required'],
    maxlength: [2000, 'Summary cannot exceed 2000 characters']
  },
  thumbnail: {
    type: String,
    required: false
  },
  pdfUrl: {
    type: String,
    required: [true, 'PDF file is required']
  },
  localPdfPath: {
    type: String,
    required: false
  },
  pages: {
    type: Number,
    min: [1, 'Pages must be at least 1']
  },
  language: {
    type: String,
    default: 'English'
  },
  publishedYear: {
    type: Number,
    min: [1000, 'Invalid year'],
    max: [new Date().getFullYear() + 1, 'Year cannot be in the future']
  },
  isbn: {
    type: String,
    unique: true,
    sparse: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  isAdminShared: {
    type: Boolean,
    default: false
  },
  isGlobal: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for search functionality
bookSchema.index({
  title: 'text',
  author: 'text',
  summary: 'text',
  tags: 'text'
});

// Virtual for like count
bookSchema.virtual('likeCount', {
  ref: 'Like',
  localField: '_id',
  foreignField: 'book',
  count: true
});

// Virtual for bookmark count
bookSchema.virtual('bookmarkCount', {
  ref: 'Bookmark',
  localField: '_id',
  foreignField: 'book',
  count: true
});

// Virtual for comment count
bookSchema.virtual('commentCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'book',
  count: true
});

// Method to increment view count
bookSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to get public book data
bookSchema.methods.getPublicData = function() {
  const bookObject = this.toObject();
  delete bookObject.__v;
  return bookObject;
};

// Ensure virtual fields are serialized
bookSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Book', bookSchema);

