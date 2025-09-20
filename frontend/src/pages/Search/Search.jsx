import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Search as SearchIcon, Filter, Grid, List, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { searchBooks, getCategories, getBooks } from '../../store/slices/bookSlice';
import userService from '../../services/userService';
import BookCard from '../../components/Books/BookCard';
import BookImageCard from '../../components/Books/BookImageCard';
import BookSkeleton from '../../components/UI/BookSkeleton';

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { searchResults = [], categories = [], loading, books = [] } = useSelector((state) => state.books);
  const { viewMode } = useSelector((state) => state.ui);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'createdAt');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState({ users: [], books: [] });

  useEffect(() => {
    dispatch(getCategories());
  }, [dispatch]);

  // Fetch popular books by default (no query yet)
  useEffect(() => {
    if (!hasSearched) {
      dispatch(getBooks({ sortBy: 'viewCount', sortOrder: 'desc', limit: 12 }));
    }
  }, [dispatch, hasSearched]);

  // Live (debounced) search while typing or changing category
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const q = searchQuery.trim();
      if (q || selectedCategory) {
        setHasSearched(true);
        setPage(1);
        // Update URL to reflect current filters
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (selectedCategory) params.set('category', selectedCategory);
        if (sortBy && sortBy !== 'createdAt') params.set('sort', sortBy);
        setSearchParams(params);

        try {
          await dispatch(searchBooks({
            query: q,
            category: selectedCategory,
            sortBy,
            sortOrder: 'desc',
            page: 1,
          })).unwrap();
        } catch (error) {
          // no-op; toast handled in handleSearch when using submit
        }

        // Live suggestions (users + top books)
        if (q) {
          try {
            const [userRes, bookRes] = await Promise.all([
              userService.searchUsers(q, 1),
              fetch(`/api/books/suggest?q=${encodeURIComponent(q)}&limit=5`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : { books: [] })
            ]);
            setSuggestions({
              users: Array.isArray(userRes?.users) ? userRes.users.slice(0, 5) : (Array.isArray(userRes) ? userRes.slice(0,5) : []),
              books: Array.isArray(bookRes?.books) ? bookRes.books.slice(0, 5) : []
            });
            setSuggestionsOpen(true);
          } catch (_) {
            setSuggestions({ users: [], books: [] });
            setSuggestionsOpen(false);
          }
        } else {
          setSuggestions({ users: [], books: [] });
          setSuggestionsOpen(false);
        }
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedCategory, sortBy, dispatch, setSearchParams]);

  const handleSearch = async () => {
    if (!searchQuery.trim() && !selectedCategory) {
      toast.error('Please enter a search term or select a category');
      return;
    }

    setHasSearched(true);
    try {
      await dispatch(searchBooks({
        query: searchQuery,
        category: selectedCategory,
        sortBy,
        sortOrder: 'desc',
        page
      })).unwrap();
    } catch (error) {
      toast.error('Search failed');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    updateURL();
    handleSearch();
  };

  const updateURL = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCategory) params.set('category', selectedCategory);
    if (sortBy && sortBy !== 'createdAt') params.set('sort', sortBy);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSortBy('newest');
    setPage(1);
    setHasSearched(false);
    setSearchParams({});
  };

  const hasActiveFilters = searchQuery || selectedCategory || sortBy !== 'newest';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Search Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Search Books</h1>
          
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="mb-6">
            <div className="relative max-w-2xl">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, or keywords..."
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                type="submit"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <span className="btn-primary">Search</span>
              </button>

              {/* Live Suggestions Panel */}
              {suggestionsOpen && (suggestions.users.length > 0 || suggestions.books.length > 0) && (
                <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-auto">
                  {/* Users */}
                  {suggestions.users.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Users</div>
                      {suggestions.users.map((u) => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => navigate(`/user/${u.username}`)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                        >
                          <img src={u.profilePicture || '/default-avatar.png'} alt={u.username} className="h-8 w-8 rounded-full object-cover" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{u.fullName || u.username}</div>
                            <div className="text-xs text-gray-500">@{u.username}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Books */}
                  {suggestions.books.length > 0 && (
                    <div className="py-2 border-t border-gray-100">
                      <div className="px-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Books</div>
                      {suggestions.books.map((b) => (
                        <button
                          key={b._id}
                          type="button"
                          onClick={() => navigate(`/books/${b._id}`)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                        >
                          <img src={b.thumbnail || '/default-book-cover.png'} alt={b.title} className="h-8 w-6 object-cover rounded" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{b.title}</div>
                            <div className="text-xs text-gray-500">{b.author}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>

          {/* Filter Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter size={18} />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="bg-primary-500 text-white text-xs px-2 py-1 rounded-full">
                  {[searchQuery, selectedCategory, sortBy !== 'newest'].filter(Boolean).length}
                </span>
              )}
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => dispatch({ type: 'ui/setViewMode', payload: 'grid' })}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-primary-100 text-primary-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => dispatch({ type: 'ui/setViewMode', payload: 'list' })}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-primary-100 text-primary-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Filters Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card p-6 mb-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="title">Title A-Z</option>
                  <option value="author">Author A-Z</option>
                  <option value="views">Most Views</option>
                  <option value="likes">Most Liked</option>
                </select>
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <X size={18} />
                    <span>Clear Filters</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Search Results */}
        <div className="space-y-6">
          {/* Results Header */}
          {!loading && hasSearched && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between"
            >
              <p className="text-gray-600">
                Found {searchResults.length} book{searchResults.length !== 1 ? 's' : ''}
                {searchQuery && ` for "${searchQuery}"`}
                {selectedCategory && ` in ${selectedCategory}`}
              </p>
            </motion.div>
          )}

          {/* Loading State */}
          {loading && (
            <div className={`grid gap-6 ${
              viewMode === 'grid' 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                : 'grid-cols-1'
            }`}>
              {Array.from({ length: 8 }).map((_, index) => (
                <BookSkeleton key={index} viewMode={viewMode} />
              ))}
            </div>
          )}

          {/* Results Grid (Instagram-like masonry of images) */}
          {!loading && hasSearched && searchResults.length > 0 && (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]"><div className="[&>*]:break-inside-avoid">
              {searchResults.map((book) => (
                <BookImageCard key={book._id} book={book} />
              ))}
            </div></div>
          )}

          {/* No Results */}
          {!loading && hasSearched && searchResults.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="max-w-md mx-auto">
                <SearchIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No books found
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery 
                    ? `No books found for "${searchQuery}"`
                    : `No books found in ${selectedCategory} category`
                  }
                </p>
                <button
                  onClick={clearFilters}
                  className="btn-primary"
                >
                  Clear Search
                </button>
              </div>
            </motion.div>
          )}

          {/* Initial State - Popular Books (Masonry) */}
          {!loading && !hasSearched && (
            books && books.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Popular Books</h3>
                </div>
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]"><div className="[&>*]:break-inside-avoid">
                  {books.map((book) => (
                    <BookImageCard key={book._id} book={book} />
                  ))}
                </div></div>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="max-w-md mx-auto">
                  <SearchIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Start your search
                  </h3>
                  <p className="text-gray-500">
                    Enter a book title, author name, or select a category to find books
                  </p>
                </div>
              </motion.div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;
