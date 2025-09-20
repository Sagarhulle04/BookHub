const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Book = require('../models/Book');
const Status = require('../models/Status');
const User = require('../models/User');

const router = express.Router();

// List conversations for current user
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'username profilePicture')
      .populate('lastMessage.book', 'title thumbnail')
      .lean();

    // Compute unreadCount per conversation and get last message timestamp
    const results = [];
    for (const c of conversations) {
      const lastReadAtBy = c.lastReadAtBy || {};
      const myKey = req.user._id.toString();
      const lastReadAt = lastReadAtBy instanceof Map ? lastReadAtBy.get(myKey) : lastReadAtBy[myKey];
      const afterDate = lastReadAt ? new Date(lastReadAt) : new Date(0);
      const unreadCount = await Message.countDocuments({
        conversation: c._id,
        createdAt: { $gt: afterDate },
        sender: { $ne: req.user._id },
        deletedFor: { $ne: req.user._id }
      });

      // Get the actual last message timestamp and content for sorting and display
      const lastMessage = await Message.findOne({
        conversation: c._id,
        deletedFor: { $ne: req.user._id }
      }).sort({ createdAt: -1 })
      .populate('sender', 'username profilePicture')
      .populate('book', 'title thumbnail')
      .populate('status')
      .populate({
        path: 'taggedStatus',
        populate: {
          path: 'user',
          select: 'username profilePicture'
        }
      })
      .select('createdAt text book status taggedStatus sender').lean();

      // Update the conversation's lastMessage with the actual last visible message
      const updatedConversation = {
        ...c,
        lastMessage: lastMessage ? {
          text: lastMessage.text,
          book: lastMessage.book,
          status: lastMessage.status,
          taggedStatus: lastMessage.taggedStatus,
          sender: lastMessage.sender,
          createdAt: lastMessage.createdAt
        } : null
      };

      results.push({ 
        ...updatedConversation, 
        unreadCount,
        lastMessageTimestamp: lastMessage?.createdAt || c.updatedAt
      });
    }

    // Sort by last message timestamp (most recent first)
    results.sort((a, b) => new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp));

    // Remove the temporary timestamp field
    const finalResults = results.map(({ lastMessageTimestamp, ...rest }) => rest);

    res.json(finalResults);
  } catch (e) {
    console.error('List conversations error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Open or create a conversation between two users
router.post('/open', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot chat with yourself' });
    }
    let convo = await Conversation.findOne({ participants: { $all: [req.user._id, userId] } });
    if (!convo) {
      convo = new Conversation({ participants: [req.user._id, userId] });
      await convo.save();
    }
    res.json(convo);
  } catch (e) {
    console.error('Open conversation error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// List messages in a conversation
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid conversation id' });
    }
    const convo = await Conversation.findById(id);
    if (!convo || !convo.participants.map(String).includes(req.user._id.toString())) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const messages = await Message.find({ conversation: id, deletedFor: { $ne: req.user._id } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sender', 'username profilePicture')
      .populate('book', 'title thumbnail')
      .populate('status')
      .populate({
        path: 'taggedStatus',
        populate: {
          path: 'user',
          select: 'username profilePicture'
        }
      })
      .lean();
    const sanitized = messages.map(m => (m.isDeleted ? { ...m, text: undefined, book: undefined } : m));
    // Extract lastReadAt for this user (if exists)
    let lastReadAt = null;
    if (convo.lastReadAtBy) {
      if (typeof convo.lastReadAtBy.get === 'function') {
        lastReadAt = convo.lastReadAtBy.get(req.user._id.toString()) || null;
      } else if (convo.lastReadAtBy[req.user._id.toString()]) {
        lastReadAt = convo.lastReadAtBy[req.user._id.toString()];
      }
    }
    res.json({ messages: sanitized.reverse(), pagination: { page, limit }, lastReadAt });
  } catch (e) {
    console.error('List messages error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message (text, book share, or status share)
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, bookId, statusId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid conversation id' });
    }
    const convo = await Conversation.findById(id);
    if (!convo || !convo.participants.map(String).includes(req.user._id.toString())) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    let book = null;
    let status = null;
    
    if (bookId) {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        return res.status(400).json({ message: 'Invalid book id' });
      }
      book = await Book.findById(bookId).select('_id title thumbnail');
      if (!book) return res.status(404).json({ message: 'Book not found' });
    }
    
    if (statusId) {
      if (!mongoose.Types.ObjectId.isValid(statusId)) {
        return res.status(400).json({ message: 'Invalid status id' });
      }
      status = await Status.findById(statusId).populate('user', 'username profilePicture');
      if (!status) return res.status(404).json({ message: 'Status not found' });
    }
    
    if (!text && !book && !status) {
      return res.status(400).json({ message: 'Message must have text, a book, or a status' });
    }
    
    const message = new Message({ 
      conversation: id, 
      sender: req.user._id, 
      text, 
      book: book ? book._id : undefined,
      status: status ? status._id : undefined
    });
    await message.save();

    convo.lastMessage = { 
      text, 
      book: book ? book._id : undefined, 
      status: status ? status._id : undefined,
      sender: req.user._id, 
      createdAt: new Date() 
    };
    await convo.save();

    // Notify via SSE
    try {
      const sseClients = req.app.get('sseClients');
      const payload = JSON.stringify({
        type: 'chat_message',
        conversationId: id,
        senderId: req.user._id,
        text: text || null,
        bookId: book ? book._id : null,
        statusId: status ? status._id : null,
        createdAt: Date.now(),
        messageId: message._id
      });
      for (const client of sseClients) {
        client.write(`event: chat_message\ndata: ${payload}\n\n`);
      }
    } catch (_) {}

    const enriched = await Message.findById(message._id)
      .populate('sender', 'username profilePicture')
      .populate('book', 'title thumbnail')
      .populate('status')
      .populate({
        path: 'taggedStatus',
        populate: {
          path: 'user',
          select: 'username profilePicture'
        }
      })
      .lean();
    res.status(201).json(enriched);
  } catch (e) {
    console.error('Send message error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark conversation as read for current user
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid conversation id' });
    }
    const convo = await Conversation.findById(id);
    if (!convo || !convo.participants.map(String).includes(req.user._id.toString())) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (!convo.lastReadAtBy) convo.lastReadAtBy = new Map();
    convo.lastReadAtBy.set(req.user._id.toString(), new Date());
    await convo.save();
    res.json({ success: true });
  } catch (e) {
    console.error('Mark read error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete all messages in a conversation (for current user only)
router.delete('/:conversationId/messages/all', auth, async (req, res) => {
  try {
    console.log('Delete all messages request received:', req.params);
    const { conversationId } = req.params;
    
    console.log('Conversation ID:', conversationId);
    console.log('ID length:', conversationId?.length);
    console.log('Is valid ObjectId:', mongoose.Types.ObjectId.isValid(conversationId));
    
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      console.log('Invalid conversation ID:', conversationId);
      return res.status(400).json({ message: 'Invalid conversation id' });
    }
    
    const convo = await Conversation.findById(conversationId);
    if (!convo || !convo.participants.map(String).includes(req.user._id.toString())) {
      console.log('Conversation not found or user not participant');
      return res.status(404).json({ message: 'Conversation not found' });
    }

    console.log('Marking all messages as deleted for user:', req.user._id);
    // Mark all messages as deleted for the current user
    const result = await Message.updateMany(
      { conversation: conversationId },
      { 
        $addToSet: { deletedFor: req.user._id }
      }
    );
    console.log('Messages updated:', result);

    // Check if there are any visible messages left for the current user
    const remainingMessages = await Message.find({ 
      conversation: conversationId,
      deletedFor: { $ne: req.user._id }
    }).sort({ createdAt: -1 }).limit(1);

    if (remainingMessages.length > 0) {
      // Keep the last visible message
      const lastMessage = remainingMessages[0];
      convo.lastMessage = {
        text: lastMessage.text,
        book: lastMessage.book,
        status: lastMessage.status,
        taggedStatus: lastMessage.taggedStatus,
        sender: lastMessage.sender,
        createdAt: lastMessage.createdAt
      };
    } else {
      // Clear the last message if no messages are visible
      convo.lastMessage = null;
    }
    await convo.save();

    // Broadcast deletion to all participants
    try {
      const sseClients = req.app.get('sseClients');
      const payload = JSON.stringify({ 
        type: 'chat_all_messages_deleted', 
        conversationId, 
        deletedBy: req.user._id 
      });
      for (const client of sseClients) {
        client.write(`event: chat_all_messages_deleted\ndata: ${payload}\n\n`);
      }
    } catch (_) {}

    console.log('Delete all messages successful');
    res.json({ success: true });
  } catch (e) {
    console.error('Delete all messages error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a message for me (hide from current user only)
router.delete('/:conversationId/messages/:messageId', auth, async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: 'Invalid ids' });
    }
    const convo = await Conversation.findById(conversationId);
    if (!convo || !convo.participants.map(String).includes(req.user._id.toString())) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    const msg = await Message.findById(messageId);
    if (!msg || String(msg.conversation) !== String(conversationId)) {
      return res.status(404).json({ message: 'Message not found' });
    }
    if (!msg.deletedFor) msg.deletedFor = [];
    if (!msg.deletedFor.map(String).includes(req.user._id.toString())) msg.deletedFor.push(req.user._id);
    await msg.save();
    res.json({ success: true });
  } catch (e) {
    console.error('Delete for me error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a message for everyone (sender only, or admin)
router.delete('/:conversationId/messages/:messageId/everyone', auth, async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: 'Invalid ids' });
    }
    const convo = await Conversation.findById(conversationId);
    if (!convo || !convo.participants.map(String).includes(req.user._id.toString())) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    const msg = await Message.findById(messageId);
    if (!msg || String(msg.conversation) !== String(conversationId)) {
      return res.status(404).json({ message: 'Message not found' });
    }
    if (String(msg.sender) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not allowed' });
    }
    msg.isDeleted = true;
    msg.deletedAt = new Date();
    msg.text = undefined;
    msg.book = undefined;
    await msg.save();

    // Broadcast deletion
    try {
      const sseClients = req.app.get('sseClients');
      const payload = JSON.stringify({ type: 'chat_message_deleted', conversationId, messageId });
      for (const client of sseClients) client.write(`event: chat_message_deleted\ndata: ${payload}\n\n`);
    } catch (_) {}

    res.json({ success: true });
  } catch (e) {
    console.error('Delete for everyone error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Handle typing indicator
router.post('/:id/typing', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isTyping } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid conversation id' });
    }
    
    const convo = await Conversation.findById(id);
    if (!convo || !convo.participants.map(String).includes(req.user._id.toString())) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Broadcast typing event to other participants
    try {
      const sseClients = req.app.get('sseClients');
      const payload = JSON.stringify({ 
        type: 'chat_typing', 
        conversationId: id,
        senderId: req.user._id,
        isTyping: isTyping
      });
      for (const client of sseClients) {
        client.write(`event: chat_typing\ndata: ${payload}\n\n`);
      }
    } catch (_) {}

    res.json({ success: true });
  } catch (e) {
    console.error('Typing indicator error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// Helper route: share a book with all users I follow
router.post('/share/book/:bookId', auth, async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: 'Invalid book id' });
    }
    const book = await Book.findById(bookId).select('_id title thumbnail');
    if (!book) return res.status(404).json({ message: 'Book not found' });

    const me = await User.findById(req.user._id).select('following');
    const followingIds = (me?.following || []).map(String);
    if (followingIds.length === 0) {
      return res.json({ message: 'No following users to share with', count: 0 });
    }

    let count = 0;
    for (const userId of followingIds) {
      let convo = await Conversation.findOne({ participants: { $all: [req.user._id, userId] } });
      if (!convo) {
        convo = new Conversation({ participants: [req.user._id, userId] });
        await convo.save();
      }
      const msg = new Message({ conversation: convo._id, sender: req.user._id, book: book._id });
      await msg.save();
      convo.lastMessage = { book: book._id, sender: req.user._id, createdAt: new Date() };
      await convo.save();
      count += 1;
    }

    // Broadcast a general chat_message event (clients can filter)
    try {
      const sseClients = req.app.get('sseClients');
      const payload = JSON.stringify({ type: 'chat_message_broadcast', bookId: book._id, senderId: req.user._id, createdAt: Date.now() });
      for (const client of sseClients) client.write(`event: chat_message\ndata: ${payload}\n\n`);
    } catch (_) {}

    res.json({ message: 'Book shared with following', count });
  } catch (e) {
    console.error('Share book error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// List users I have shared a book with (sent by me)
router.get('/shared/sent', auth, async (req, res) => {
  try {
    const pipeline = [
      { $match: { sender: req.user._id, book: { $ne: null } } },
      { $lookup: {
          from: 'conversations',
          localField: 'conversation',
          foreignField: '_id',
          as: 'conversation'
      }},
      { $unwind: '$conversation' },
      { $project: {
          participants: '$conversation.participants',
          conversationId: '$conversation._id'
      }},
      { $addFields: {
          other: {
            $cond: [
              { $eq: [ { $arrayElemAt: ['$participants', 0] }, req.user._id ] },
              { $arrayElemAt: ['$participants', 1] },
              { $arrayElemAt: ['$participants', 0] }
            ]
          }
      }},
      { $group: { _id: '$other', conversationId: { $first: '$conversationId' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, conversationId: 1, user: { _id: '$user._id', username: '$user.username', profilePicture: '$user.profilePicture' } } }
    ];
    const results = await Message.aggregate(pipeline);
    res.json({ users: results.map(r => ({ ...r.user, conversationId: r.conversationId })) });
  } catch (e) {
    console.error('List shared recipients error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});


