import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import bookmarkService from '../../services/bookmarkService';

const initialState = {
  bookmarkedBooks: [],
  folders: [],
  isBookmarked: false,
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: '',
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalBooks: 0,
    hasNext: false,
    hasPrev: false,
    limit: 12,
  },
};

// Toggle bookmark for a book
export const toggleBookmark = createAsyncThunk(
  'bookmarks/toggle',
  async (bookIdOrPayload, thunkAPI) => {
    try {
      // Support both call shapes: toggleBookmark(id) or toggleBookmark({ bookId, folder, note })
      const payload = typeof bookIdOrPayload === 'object'
        ? bookIdOrPayload
        : { bookId: bookIdOrPayload };
      const { bookId, folder, note } = payload;
      return await bookmarkService.toggleBookmark(bookId, { folder, note });
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Check if user bookmarked a book
export const checkBookmark = createAsyncThunk(
  'bookmarks/check',
  async (bookId, thunkAPI) => {
    try {
      return await bookmarkService.checkBookmark(bookId);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Get user's bookmarked books
export const getBookmarkedBooks = createAsyncThunk(
  'bookmarks/getBookmarkedBooks',
  async ({ userId, page = 1, folder = 'all' }, thunkAPI) => {
    try {
      return await bookmarkService.getBookmarkedBooks(userId, page, folder);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Get user's bookmark folders
export const getBookmarkFolders = createAsyncThunk(
  'bookmarks/getFolders',
  async (userId, thunkAPI) => {
    try {
      return await bookmarkService.getFolders(userId);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Update bookmark details
export const updateBookmark = createAsyncThunk(
  'bookmarks/update',
  async ({ bookId, folder, note }, thunkAPI) => {
    try {
      return await bookmarkService.updateBookmark(bookId, folder, note);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const bookmarkSlice = createSlice({
  name: 'bookmarks',
  initialState,
  reducers: {
    reset: (state) => {
      state.isLoading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = '';
    },
    clearBookmarkedBooks: (state) => {
      state.bookmarkedBooks = [];
      state.pagination = {
        currentPage: 1,
        totalPages: 1,
        totalBooks: 0,
        hasNext: false,
        hasPrev: false,
        limit: 12,
      };
    },
    updateBookBookmark: (state, action) => {
      const { bookId, bookmarked, bookmark } = action.payload;
      const book = state.bookmarkedBooks.find((b) => b._id === bookId);
      if (book) {
        book.bookmarked = bookmarked;
        book.bookmark = bookmark;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(toggleBookmark.fulfilled, (state, action) => {
        state.isSuccess = true;
        state.isBookmarked = !!action.payload.bookmarked;
      })
      .addCase(checkBookmark.fulfilled, (state, action) => {
        state.isBookmarked = !!action.payload.bookmarked;
      })
      .addCase(getBookmarkedBooks.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getBookmarkedBooks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.bookmarkedBooks = action.payload.books;
        state.pagination = action.payload.pagination;
      })
      .addCase(getBookmarkedBooks.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getBookmarkFolders.fulfilled, (state, action) => {
        state.folders = action.payload;
      })
      .addCase(updateBookmark.fulfilled, (state, action) => {
        state.isSuccess = true;
        // Update the bookmark in the list if it exists
        const book = state.bookmarkedBooks.find(
          (b) => b._id === action.payload.bookmark.book
        );
        if (book) {
          book.folder = action.payload.bookmark.folder;
          book.note = action.payload.bookmark.note;
        }
      });
  },
});

export const {
  reset,
  clearBookmarkedBooks,
  updateBookBookmark,
} = bookmarkSlice.actions;
export default bookmarkSlice.reducer;
