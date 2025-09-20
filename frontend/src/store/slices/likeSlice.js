import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import likeService from '../../services/likeService';

const initialState = {
  likedBooks: [],
  isLiked: false,
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

// Toggle like for a book
export const toggleLike = createAsyncThunk(
  'likes/toggle',
  async (bookId, thunkAPI) => {
    try {
      return await likeService.toggleLike(bookId);
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

// Check if user liked a book
export const checkLike = createAsyncThunk(
  'likes/check',
  async (bookId, thunkAPI) => {
    try {
      return await likeService.checkLike(bookId);
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

// Get user's liked books
export const getLikedBooks = createAsyncThunk(
  'likes/getLikedBooks',
  async ({ userId, page = 1 }, thunkAPI) => {
    try {
      return await likeService.getLikedBooks(userId, page);
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

export const likeSlice = createSlice({
  name: 'likes',
  initialState,
  reducers: {
    reset: (state) => {
      state.isLoading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = '';
    },
    clearLikedBooks: (state) => {
      state.likedBooks = [];
      state.pagination = {
        currentPage: 1,
        totalPages: 1,
        totalBooks: 0,
        hasNext: false,
        hasPrev: false,
        limit: 12,
      };
    },
    updateBookLike: (state, action) => {
      const { bookId, liked } = action.payload;
      const book = state.likedBooks.find((b) => b._id === bookId);
      if (book) {
        book.liked = liked;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(toggleLike.fulfilled, (state, action) => {
        state.isSuccess = true;
        state.isLiked = !!action.payload.liked;
      })
      .addCase(checkLike.fulfilled, (state, action) => {
        state.isLiked = !!action.payload.liked;
      })
      .addCase(getLikedBooks.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getLikedBooks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.likedBooks = action.payload.books;
        state.pagination = action.payload.pagination;
      })
      .addCase(getLikedBooks.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export const { reset, clearLikedBooks, updateBookLike } = likeSlice.actions;
export default likeSlice.reducer;
