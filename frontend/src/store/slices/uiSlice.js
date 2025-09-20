import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sidebarOpen: false,
  mobileNavOpen: false,
  theme: 'light',
  viewMode: 'grid', // 'grid' or 'list'
  searchQuery: '',
  selectedCategory: 'all',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  showFilters: false,
  showUploadModal: false,
  showBookmarkModal: false,
  showCommentModal: false,
  selectedBook: null,
  notifications: [],
  unreadCount: 0,
  unreadChats: 0,
  unreadChatSenderIds: [],
  unreadByConversation: {},
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    closeSidebar: (state) => {
      state.sidebarOpen = false;
    },
    toggleMobileNav: (state) => {
      state.mobileNavOpen = !state.mobileNavOpen;
    },
    closeMobileNav: (state) => {
      state.mobileNavOpen = false;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setViewMode: (state, action) => {
      state.viewMode = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setSelectedCategory: (state, action) => {
      state.selectedCategory = action.payload;
    },
    setSortBy: (state, action) => {
      state.sortBy = action.payload;
    },
    setSortOrder: (state, action) => {
      state.sortOrder = action.payload;
    },
    toggleFilters: (state) => {
      state.showFilters = !state.showFilters;
    },
    showFilters: (state) => {
      state.showFilters = true;
    },
    hideFilters: (state) => {
      state.showFilters = false;
    },
    toggleUploadModal: (state) => {
      state.showUploadModal = !state.showUploadModal;
    },
    showUploadModal: (state) => {
      state.showUploadModal = true;
    },
    hideUploadModal: (state) => {
      state.showUploadModal = false;
    },
    toggleBookmarkModal: (state) => {
      state.showBookmarkModal = !state.showBookmarkModal;
    },
    showBookmarkModal: (state, action) => {
      state.showBookmarkModal = true;
      state.selectedBook = action.payload;
    },
    hideBookmarkModal: (state) => {
      state.showBookmarkModal = false;
      state.selectedBook = null;
    },
    toggleCommentModal: (state) => {
      state.showCommentModal = !state.showCommentModal;
    },
    showCommentModal: (state, action) => {
      state.showCommentModal = true;
      state.selectedBook = action.payload;
    },
    hideCommentModal: (state) => {
      state.showCommentModal = false;
      state.selectedBook = null;
    },
    addNotification: (state, action) => {
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
    },
    setNotifications: (state, action) => {
      state.notifications = action.payload;
    },
    setUnreadCount: (state, action) => {
      state.unreadCount = action.payload;
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    setUnreadChats: (state, action) => {
      state.unreadChats = action.payload;
    },
    incrementUnreadChats: (state, action) => {
      state.unreadChats += (action.payload || 1);
    },
    resetUnreadChats: (state) => {
      state.unreadChats = 0;
    },
    addUnreadChatSender: (state, action) => {
      const id = String(action.payload || '');
      if (!id) return;
      if (!state.unreadChatSenderIds.map(String).includes(id)) {
        state.unreadChatSenderIds.push(id);
      }
    },
    resetUnreadChatSenders: (state) => {
      state.unreadChatSenderIds = [];
    },
    setUnreadChatSenders: (state, action) => {
      state.unreadChatSenderIds = Array.isArray(action.payload) ? action.payload : [];
    },
    incrementUnreadForConversation: (state, action) => {
      const id = String(action.payload || '');
      if (!id) return;
      const entry = state.unreadByConversation[id] || { count: 0 };
      state.unreadByConversation[id] = { count: (entry.count || 0) + 1 };
    },
    resetUnreadForConversation: (state, action) => {
      const id = String(action.payload || '');
      if (!id) return;
      state.unreadByConversation[id] = { count: 0 };
    },
    decrementUnreadTotalsForConversation: (state, action) => {
      const id = String(action.payload || '');
      if (!id) return;
      const prev = state.unreadByConversation[id]?.count || 0;
      if (prev > 0) state.unreadByConversation[id] = { count: 0 };
      // Also drop sender from badge list if present
      state.unreadChatSenderIds = state.unreadChatSenderIds.filter((x) => x !== id);
    },
    setUnreadByConversation: (state, action) => {
      const obj = action.payload;
      state.unreadByConversation = obj && typeof obj === 'object' ? obj : {};
    },
    resetUI: (state) => {
      state.sidebarOpen = false;
      state.mobileNavOpen = false;
      state.showFilters = false;
      state.showUploadModal = false;
      state.showBookmarkModal = false;
      state.showCommentModal = false;
      state.selectedBook = null;
    },
  },
});

export const {
  toggleSidebar,
  closeSidebar,
  toggleMobileNav,
  closeMobileNav,
  setTheme,
  setViewMode,
  setSearchQuery,
  setSelectedCategory,
  setSortBy,
  setSortOrder,
  toggleFilters,
  showFilters,
  hideFilters,
  toggleUploadModal,
  showUploadModal,
  hideUploadModal,
  toggleBookmarkModal,
  showBookmarkModal,
  hideBookmarkModal,
  toggleCommentModal,
  showCommentModal,
  hideCommentModal,
  addNotification,
  setNotifications,
  setUnreadCount,
  removeNotification,
  clearNotifications,
  setUnreadChats,
  incrementUnreadChats,
  resetUnreadChats,
  addUnreadChatSender,
  resetUnreadChatSenders,
  setUnreadChatSenders,
  setUnreadByConversation,
  incrementUnreadForConversation,
  resetUnreadForConversation,
  decrementUnreadTotalsForConversation,
  resetUI,
} = uiSlice.actions;

export default uiSlice.reducer;
