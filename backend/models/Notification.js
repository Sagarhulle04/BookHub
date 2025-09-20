const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['follow', 'book_liked', 'book_bookmarked', 'comment', 'status_posted', 'status_tagged']
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  // Optional fields for different notification types
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book'
  },
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  statusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Status'
  },
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this({
    recipient: data.recipientId,
    sender: data.senderId,
    type: data.type,
    message: data.message,
    bookId: data.bookId,
    commentId: data.commentId,
    statusId: data.statusId,
    metadata: data.metadata || {}
  });
  
  return await notification.save();
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
