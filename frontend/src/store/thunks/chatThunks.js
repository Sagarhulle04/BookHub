import { createAsyncThunk } from '@reduxjs/toolkit';
import chatService from '../../services/chatService';
import { resetUnreadForConversation } from '../slices/uiSlice';

export const markConversationRead = createAsyncThunk(
  'chat/markConversationRead',
  async (conversationId, { dispatch, rejectWithValue }) => {
    try {
      await chatService.markConversationRead(conversationId);
      dispatch(resetUnreadForConversation(conversationId));
      return { conversationId };
    } catch (e) {
      return rejectWithValue(e?.response?.data || { message: 'Failed to mark read' });
    }
  }
);


