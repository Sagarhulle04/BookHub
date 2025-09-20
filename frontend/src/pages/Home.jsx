import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getBooks, getFeed, setFilters } from '../store/slices/bookSlice';
import { getCategories } from '../store/slices/bookSlice';
import BookCard from '../components/Books/BookCard';
import BookSkeleton from '../components/UI/BookSkeleton';
import { BookOpen, Sparkles, Users, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import bookService from '../services/bookService';

// Custom hook for debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const Home = () => {
  const dispatch = useDispatch();
  const { books, isLoading, pagination, filters } = useSelector((state) => state.books);
  const { categories } = useSelector((state) => state.books);
  const { viewMode } = useSelector((state) => state.ui);
  const { user } = useSelector((state) => state.auth);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [tab, setTab] = useState('forYou'); // forYou | latest | recommendations
  const [allBooks, setAllBooks] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedInfo, setFeedInfo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const observerRef = useRef();
  const lastBookElementRef = useRef();
  const feedLoadingRef = useRef(false);
  const feedCacheRef = useRef(new Map());

  // Debounce filters to prevent excessive API calls
  const debouncedFilters = useDebounce(filters, 300);

  const loadFeed = useCallback(async (page, reset = false) => {
    if (feedLoadingRef.current && !reset) return; // Prevent multiple simultaneous calls
    
    const cacheKey = `feed_${page}`;
    
    // Check cache first
    if (!reset && feedCacheRef.current.has(cacheKey)) {
      const cachedData = feedCacheRef.current.get(cacheKey);
      const newBooks = cachedData.books || [];
      
      if (reset) {
        setAllBooks(newBooks);
      } else {
        setAllBooks(prev => [...prev, ...newBooks]);
      }
      
      setHasMore(cachedData.pagination?.hasNext || false);
      setFeedInfo(cachedData.feedInfo);
      return;
    }
    
    feedLoadingRef.current = true;
    try {
      if (reset) {
        setAllBooks([]);
        setCurrentPage(1);
      }
      
      const response = await bookService.getFeed({ page, limit: 12 });
      const newBooks = response.books || [];
      
      // Cache the response
      feedCacheRef.current.set(cacheKey, response);
      
      if (reset) {
        setAllBooks(newBooks);
      } else {
        setAllBooks(prev => [...prev, ...newBooks]);
      }
      
      setHasMore(response.pagination?.hasNext || false);
      setFeedInfo(response.feedInfo);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      feedLoadingRef.current = false;
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    if (!user || loadingRecommendations) return; // Prevent multiple simultaneous calls
    
    setLoadingRecommendations(true);
    try {
      const response = await bookService.getRecommendations(20);
      setRecommendations(response.recommendations || []);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  }, [user, loadingRecommendations]);

  // Add request deduplication for feed loading
  const feedRequestRef = useRef(null);
  
  const loadFeedWithDeduplication = useCallback(async (page, reset = false) => {
    const requestKey = `feed_${page}_${reset}`;
    
    // If same request is already in progress, return the existing promise
    if (feedRequestRef.current && feedRequestRef.current.key === requestKey) {
      return feedRequestRef.current.promise;
    }
    
    // Create new request
    const promise = loadFeed(page, reset);
    feedRequestRef.current = { key: requestKey, promise };
    
    try {
      await promise;
    } finally {
      // Clear the request reference when done
      if (feedRequestRef.current?.key === requestKey) {
        feedRequestRef.current = null;
      }
    }
    
    return promise;
  }, [loadFeed]);

  // Load initial feed
  useEffect(() => {
    if (tab === 'forYou') {
      loadFeedWithDeduplication(1, true);
    } else if (tab === 'recommendations') {
      loadRecommendations();
    } else {
      dispatch(getBooks({ page: currentPage, ...debouncedFilters }));
    }
  }, [dispatch, currentPage, debouncedFilters, tab, loadFeedWithDeduplication]);

  useEffect(() => {
    if (!categories) {
      dispatch(getCategories());
    }
  }, [dispatch, categories]);

  // Cleanup cache on unmount
  useEffect(() => {
    return () => {
      feedCacheRef.current.clear();
    };
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    
    if (tab === 'forYou') {
      loadFeedWithDeduplication(nextPage, false);
    } else if (tab === 'latest') {
      dispatch(getBooks({ page: nextPage, ...debouncedFilters }));
    }
    
    setLoadingMore(false);
  }, [loadingMore, hasMore, currentPage, tab, dispatch, debouncedFilters, loadFeedWithDeduplication]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    
    if (lastBookElementRef.current) {
      observer.observe(lastBookElementRef.current);
    }
    
    return () => {
      if (lastBookElementRef.current) {
        observer.unobserve(lastBookElementRef.current);
      }
    };
  }, [loadMore, hasMore, loadingMore]);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setCurrentPage(1);
    setAllBooks([]);
    setHasMore(true);
    
    if (newTab === 'recommendations') {
      loadRecommendations();
    }
  };

  const getCurrentBooks = () => {
    if (tab === 'recommendations') {
      return recommendations;
    } else if (tab === 'forYou') {
      return allBooks;
    } else {
      return books;
    }
  };

  const getCurrentLoading = () => {
    if (tab === 'recommendations') {
      return loadingRecommendations;
    } else if (tab === 'forYou') {
      return isLoading && currentPage === 1;
    } else {
      return isLoading;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleTabChange('forYou')} 
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
              tab === 'forYou' 
                ? 'bg-primary-600 text-white' 
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            For You
          </button>
          <button 
            onClick={() => handleTabChange('latest')} 
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
              tab === 'latest' 
                ? 'bg-primary-600 text-white' 
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Latest
          </button>
          {user && (
            <button 
              onClick={() => handleTabChange('recommendations')} 
              className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                tab === 'recommendations' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="h-4 w-4" />
              Recommended
            </button>
          )}
        </div>
        
        {/* Feed Info */}
        {feedInfo && tab === 'forYou' && (
          <div className="text-xs text-gray-500 hidden sm:block">
            {feedInfo.latestBooks} latest • {feedInfo.followingBooks} following • {feedInfo.adminBooks} admin
          </div>
        )}
      </div>

      {/* Books Grid/List - responsive widths */}
      {getCurrentLoading() ? (
        <div className="grid gap-6 place-items-center grid-cols-1">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="w-full max-w-full sm:max-w-xl md:max-w-2xl">
              <BookSkeleton viewMode={'grid'} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:gap-6 place-items-center grid-cols-1"
          >
            {getCurrentBooks().map((book, index) => {
              const isLastBook = index === getCurrentBooks().length - 1;
              return (
                <motion.div 
                  key={book._id} 
                  variants={itemVariants} 
                  className="w-full max-w-full sm:max-w-xl md:max-w-2xl"
                  ref={isLastBook ? lastBookElementRef : null}
                >
                  <BookCard book={book} viewMode={'grid'} />
                </motion.div>
              );
            })}
          </motion.div>

          {/* Loading More Indicator */}
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                <span className="text-sm">Loading more books...</span>
              </div>
            </div>
          )}

          {/* End of Feed Message */}
          {!hasMore && getCurrentBooks().length > 0 && tab === 'forYou' && (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">You've reached the end of your feed!</p>
              <p className="text-xs mt-1">Check back later for more books</p>
            </div>
          )}

          {/* No Books Message */}
          {getCurrentBooks().length === 0 && !getCurrentLoading() && (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No books found</p>
              <p className="text-sm">
                {tab === 'recommendations' 
                  ? 'Start liking and bookmarking books to get personalized recommendations!'
                  : 'Try following some users or check back later for new books.'
                }
              </p>
            </div>
          )}

          {/* Pagination for Latest tab */}
          {tab === 'latest' && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.hasPrev}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    page === currentPage
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasNext}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Home;
