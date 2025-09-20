const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Status = require('../models/Status');
const Notification = require('../models/Notification');
const cloudinary = require('../utils/cloudinary');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Create a status (image/video) - stored on Cloudinary
router.post('/', auth, upload.single('media'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Media file is required' });

    const isVideo = req.file.mimetype.startsWith('video/');
    const resource_type = isVideo ? 'video' : 'image';

    const uploadStream = cloudinary.uploader.upload_stream({ resource_type, folder: 'bookhub/status' }, async (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Upload failed', error: err.message });
      }
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Parse tagged users and other data
      let taggedUsers = [];
      let text = '';
      let emojis = [];
      
      try {
        taggedUsers = req.body.taggedUsers ? JSON.parse(req.body.taggedUsers) : [];
        text = req.body.text || '';
        emojis = req.body.emojis ? JSON.parse(req.body.emojis) : [];
      } catch (e) {
        console.error('Error parsing status data:', e);
      }
      
      const status = new Status({ 
        user: req.user._id, 
        mediaUrl: result.secure_url, 
        mediaType: isVideo ? 'video' : 'image', 
        caption: req.body.caption || '', 
        text: text,
        taggedUsers: taggedUsers,
        emojis: emojis,
        expiresAt 
      });
      await status.save();

      // Send notifications to tagged users and create chat messages
      try {
        const Message = require('../models/Message');
        const Conversation = require('../models/Conversation');
        
        for (const taggedUserId of taggedUsers) {
          if (taggedUserId !== req.user._id.toString()) {
            // Create notification
            const notification = await Notification.createNotification({
              recipientId: taggedUserId,
              senderId: req.user._id,
              type: 'status_tagged',
              message: `${req.user.username} tagged you in a status`,
              statusId: status._id,
              metadata: { statusText: text }
            });

            // Create or find conversation between the users
            let conversation = await Conversation.findOne({ 
              participants: { $all: [req.user._id, taggedUserId] } 
            });
            
            if (!conversation) {
              conversation = new Conversation({ 
                participants: [req.user._id, taggedUserId] 
              });
              await conversation.save();
            }

            // Create a tagged status message in the conversation
            const taggedMessage = new Message({
              conversation: conversation._id,
              sender: req.user._id,
              taggedStatus: status._id,
              text: `${req.user.username} tagged you in a status`
            });
            await taggedMessage.save();

            // Update conversation's last message
            conversation.lastMessage = {
              text: `${req.user.username} tagged you in a status`,
              taggedStatus: status._id,
              sender: req.user._id,
              createdAt: new Date()
            };
            await conversation.save();

            // Send real-time notification via SSE
            try {
              const sseClients = req.app.get('sseClients');
              const payload = JSON.stringify({
                type: 'status_tagged',
                recipientId: taggedUserId,
                senderId: req.user._id,
                senderUsername: req.user.username,
                message: `${req.user.username} tagged you in a status`,
                statusId: status._id,
                statusText: text,
                createdAt: Date.now(),
                notificationId: notification._id,
                messageId: taggedMessage._id,
                conversationId: conversation._id,
                taggedStatusId: status._id
              });
              for (const client of sseClients) {
                client.write(`event: notification\ndata: ${payload}\n\n`);
              }
            } catch (sseError) {
              console.error('SSE notification error:', sseError);
            }
          }
        }
      } catch (e) {
        console.error('Error creating tag notifications and messages:', e);
      }

      // Notify followers via SSE (optional broadcast)
      // Note: Status notifications are broadcast to all followers, not individual recipients
      try {
        const sseClients = req.app.get('sseClients');
        const payload = JSON.stringify({ 
          type: 'status_posted', 
          userId: req.user._id, 
          mediaType: status.mediaType, 
          createdAt: Date.now() 
        });
        for (const client of sseClients) client.write(`event: notification\ndata: ${payload}\n\n`);
      } catch (_) {}

      return res.status(201).json(status);
    });

    // Pipe buffer to cloudinary stream
    uploadStream.end(req.file.buffer);
  } catch (e) {
    console.error('Create status error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Feed: statuses from me and people I follow (not expired)
router.get('/feed', auth, async (req, res) => {
  try {
    const me = req.user;
    const ids = [me._id, ...(me.following || [])];
    
    // Get statuses from people I follow
    const followingStatuses = await Status.find({ user: { $in: ids }, expiresAt: { $gt: new Date() } })
      .populate('user', 'username profilePicture')
      .populate('taggedUsers', 'username profilePicture')
      .sort({ createdAt: -1 })
      .lean();
    
    // Get statuses where I am tagged
    const taggedStatuses = await Status.find({ 
      taggedUsers: me._id, 
      expiresAt: { $gt: new Date() } 
    })
      .populate('user', 'username profilePicture')
      .populate('taggedUsers', 'username profilePicture')
      .sort({ createdAt: -1 })
      .lean();
    
    // Combine and deduplicate (in case a status is both from following and tagged)
    const allStatuses = [...followingStatuses, ...taggedStatuses];
    const uniqueStatuses = allStatuses.filter((status, index, self) => 
      index === self.findIndex(s => s._id.toString() === status._id.toString())
    );
    
    // Sort by creation date
    uniqueStatuses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(uniqueStatuses);
  } catch (e) {
    console.error('Status feed error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as viewed
router.post('/:id/view', auth, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    if (!status.views.map(String).includes(req.user._id.toString())) {
      status.views.push(req.user._id);
      await status.save();
    }
    res.json({ message: 'Viewed' });
  } catch (e) {
    console.error('View status error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a re-mention status from a tagged status
router.post('/re-mention/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid status id' });
    }
    
    // Find the original tagged status
    const originalStatus = await Status.findById(id);
    if (!originalStatus) {
      return res.status(404).json({ message: 'Original status not found' });
    }
    
    // Create a new status with the same media but different user
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const reMentionStatus = new Status({
      user: req.user._id,
      mediaUrl: originalStatus.mediaUrl,
      mediaType: originalStatus.mediaType,
      caption: originalStatus.caption,
      text: text || originalStatus.text,
      taggedUsers: [originalStatus.user], // Tag the original user
      emojis: originalStatus.emojis,
      expiresAt
    });
    
    await reMentionStatus.save();
    
    // Send notification to the original user
    try {
      const notification = await Notification.createNotification({
        recipientId: originalStatus.user,
        senderId: req.user._id,
        type: 'status_tagged',
        message: `${req.user.username} re-mentioned you in a status`,
        statusId: reMentionStatus._id,
        metadata: { statusText: text || originalStatus.text }
      });

      // Send real-time notification via SSE
      try {
        const sseClients = req.app.get('sseClients');
        const payload = JSON.stringify({
          type: 'status_tagged',
          recipientId: originalStatus.user,
          senderId: req.user._id,
          senderUsername: req.user.username,
          message: `${req.user.username} re-mentioned you in a status`,
          statusId: reMentionStatus._id,
          statusText: text || originalStatus.text,
          createdAt: Date.now(),
          notificationId: notification._id
        });
        for (const client of sseClients) {
          client.write(`event: notification\ndata: ${payload}\n\n`);
        }
      } catch (sseError) {
        console.error('SSE notification error:', sseError);
      }
    } catch (e) {
      console.error('Error creating re-mention notification:', e);
    }
    
    res.status(201).json(reMentionStatus);
  } catch (e) {
    console.error('Re-mention status error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete own status
router.delete('/:id', auth, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    if (status.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    await status.deleteOne();
    res.json({ message: 'Status deleted' });
  } catch (e) {
    console.error('Delete status error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


