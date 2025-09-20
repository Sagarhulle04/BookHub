import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import bookService from '../../services/bookService';

const initialState = {
  books: [],
  searchResults: [],
  myUploads: [],
  categories: [],
  currentBook: null,
  isError: false,
  isSuccess: false,
  isLoading: false,
  loading: false,
  message: '',
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalBooks: 0,
    hasNext: false,
    hasPrev: false,
    limit: 12,
  },
  filters: {
    category: 'all',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
};

// Get all books
export const getBooks = createAsyncThunk(
  'books/getAll',
  async (filters, thunkAPI) => {
    try {
      return await bookService.getBooks(filters);
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

// Personalized feed
export const getFeed = createAsyncThunk(
  'books/getFeed',
  async (filters, thunkAPI) => {
    try {
      return await bookService.getFeed(filters);
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

// Get book by ID
export const getBookById = createAsyncThunk(
  'books/getById',
  async (bookId, thunkAPI) => {
    try {
      return await bookService.getBookById(bookId);
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

// Search books
export const searchBooks = createAsyncThunk(
  'books/search',
  async (searchParams, thunkAPI) => {
    try {
      // Map UI params to API params
      const apiParams = {
        q: searchParams.query,
        category: searchParams.category,
        author: searchParams.author,
        year: searchParams.year,
        language: searchParams.language,
        sortBy: searchParams.sortBy,
        sortOrder: searchParams.sortOrder,
        page: searchParams.page,
        limit: searchParams.limit,
      };
      return await bookService.searchBooks(apiParams);
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

// Get book categories
export const getCategories = createAsyncThunk(
  'books/getCategories',
  async (_, thunkAPI) => {
    try {
      return await bookService.getCategories();
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

// Get user's uploaded books
export const getMyUploads = createAsyncThunk(
  'books/getMyUploads',
  async (filters, thunkAPI) => {
    try {
      return await bookService.getMyUploads(filters);
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

// Create new book (authenticated users)
export const createBook = createAsyncThunk(
  'books/create',
  async (bookData, thunkAPI) => {
    try {
      return await bookService.createBook(bookData);
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

export const bookSlice = createSlice({
  name: 'books',
  initialState,
  reducers: {
    reset: (state) => {
      state.isLoading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = '';
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearCurrentBook: (state) => {
      state.currentBook = null;
      state.loading = false;
      state.isLoading = false;
      state.isError = false;
      state.message = '';
    },
    addBook: (state, action) => {
      state.books.unshift(action.payload);
    },
    updateBook: (state, action) => {
      const index = state.books.findIndex(
        (book) => book._id === action.payload._id
      );
      if (index !== -1) {
        state.books[index] = action.payload;
      }
      if (state.currentBook?._id === action.payload._id) {
        state.currentBook = action.payload;
      }
    },
    removeBook: (state, action) => {
      state.books = state.books.filter(
        (book) => book._id !== action.payload
      );
      if (state.currentBook?._id === action.payload) {
        state.currentBook = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getBooks.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
      })
      .addCase(getBooks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.isSuccess = true;
        state.books = action.payload.books;
        state.pagination = action.payload.pagination;
      })
      .addCase(getFeed.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
      })
      .addCase(getFeed.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.isSuccess = true;
        state.books = action.payload.books;
        state.pagination = action.payload.pagination;
      })
      .addCase(getFeed.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getBooks.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getBookById.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
      })
      .addCase(getBookById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.isSuccess = true;
        state.currentBook = action.payload;
      })
      .addCase(getBookById.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(searchBooks.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
      })
      .addCase(searchBooks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.isSuccess = true;
        state.searchResults = action.payload.books;
        state.pagination = action.payload.pagination;
      })
      .addCase(searchBooks.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getCategories.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
      })
      .addCase(getCategories.rejected, (state, action) => {
        state.loading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getMyUploads.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
      })
      .addCase(getMyUploads.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.isSuccess = true;
        state.myUploads = action.payload.books;
        state.pagination = action.payload.pagination;
      })
      .addCase(getMyUploads.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(createBook.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createBook.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.message = action.payload.message;
        if (action.payload.book) {
          console.log('Adding book to store:', action.payload.book);
          console.log('Book ID:', action.payload.book._id);
          state.books.unshift(action.payload.book);
          state.pagination.totalBooks += 1;
        }
      })
      .addCase(createBook.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export const {
  reset,
  setFilters,
  clearCurrentBook,
  addBook,
  updateBook,
  removeBook,
} = bookSlice.actions;
export default bookSlice.reducer;
