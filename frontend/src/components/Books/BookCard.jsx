import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleLike } from '../../store/slices/likeSlice';
import { toggleBookmark } from '../../store/slices/bookmarkSlice';
import { Heart, Bookmark, Eye, User, BookOpen, MessageCircle, MoreHorizontal, Send, Globe, Globe2, EyeOff } from 'lucide-react';
import api from '../../services/axiosConfig';
import { getCurrentUser } from '../../store/slices/authSlice';
import chatService from '../../services/chatService';
import ShareModal from './ShareModal';
import { motion } from 'framer-motion';
import likeService from '../../services/likeService';
import commentService from '../../services/commentService';
import bookService from '../../services/bookService';
import toast from 'react-hot-toast';
import { cachedFetch } from '../../services/requestCache';

const BookCard = ({ book, viewMode = 'grid' }) => {
  if (!book) {
    return null;
  }
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const isProfileView = location.pathname.startsWith('/profile');
  const imageWrapperClass = isProfileView ? 'h-24' : 'aspect-[3/4]';
  
  // Local optimistic UI state (list results don't include flags)
  const [isLiked, setIsLiked] = useState(!!book?.liked);
  const [isBookmarked, setIsBookmarked] = useState(!!book?.bookmarked);
  const [likeCount, setLikeCount] = useState(typeof book?.likeCount === 'number' ? book.likeCount : 0);
  const [commentCount, setCommentCount] = useState(0);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    setIsLiked(!!book?.liked);
  }, [book?.liked]);

  useEffect(() => {
    setIsBookmarked(!!book?.bookmarked);
  }, [book?.bookmarked]);

  useEffect(() => {
    if (user && book?.uploadedBy?._id) {
      const followingIds = (user.following || [])
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object') {
            // Support populated user docs { _id, username, ... }
            if (entry._id) return entry._id.toString();
          }
          try { return entry?.toString?.(); } catch (_) { return null; }
        })
        .filter(Boolean);
      setIsFollowing(followingIds.includes(book.uploadedBy._id.toString()));
    } else {
      setIsFollowing(false);
    }
  }, [user, user?.following, book?.uploadedBy?._id]);

  // Fetch counts lazily with caching and deduplication
  useEffect(() => {
    let mounted = true;
    let timeoutId;
    
    // Debounce the API calls to prevent rapid successive requests
    const fetchCounts = async () => {
      if (!mounted) return;
      
      try {
        // Use cached fetch for like count
        const likeUrl = `/api/likes/book/${book._id}/count`;
        const lc = await cachedFetch(likeUrl);
        if (mounted && typeof lc?.count === 'number') {
          setLikeCount(lc.count);
        }
      } catch (_) {}
      
      try {
        // Use cached fetch for comment count
        const commentUrl = `/api/comments/book/${book._id}?page=1`;
        const cs = await cachedFetch(commentUrl);
        if (mounted && cs?.pagination?.totalComments != null) {
          setCommentCount(cs.pagination.totalComments);
        }
      } catch (_) {}
    };

    // Debounce the fetch to prevent rapid successive calls
    timeoutId = setTimeout(fetchCounts, 100);
    
    return () => { 
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [book._id]);

  const handleLike = (e) => {
    e.preventDefault();
    if (!user) {
      // Show login prompt or redirect
      return;
    }
    // Optimistic toggle
    setIsLiked((prev) => !prev);
    setLikeCount((count) => (isLiked ? Math.max(0, count - 1) : count + 1));
    dispatch(toggleLike(book._id));
  };

  const handleBookmark = (e) => {
    e.preventDefault();
    if (!user) {
      // Show login prompt or redirect
      return;
    }
    // Optimistic toggle
    setIsBookmarked((prev) => !prev);
    dispatch(toggleBookmark(book._id));
  };

  const handleCommentClick = (e) => {
    e.preventDefault();
    if (!user) {
      return;
    }
    // Show a toast-like inline indicator by navigating to detail with a flag to open comments
    navigate(`/books/${book._id}?openComments=1`);
  };

  const handleReadClick = (e) => {
    // Allow middle-click/new tab behavior without interception
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return;

    if (!user) {
      e.preventDefault();
      const intendedUrl = `/books/${book._id}/read`;
      try {
        sessionStorage.setItem('returnAfterLogin', JSON.stringify({ url: intendedUrl, scrollY: window.scrollY }));
      } catch (_) {}
      navigate('/login', { state: { from: location } });
    }
    // else allow default navigation
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="card p-6 w-full max-w-xl mx-auto"
      >
        <div className="flex items-start space-x-4">
          {/* Book Cover */}
          <Link to={`/books/${book._id}/read`} onClick={handleReadClick} className="flex-shrink-0">
            <div className="w-24 h-32 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
              {book.thumbnail ? (
                <img
                  src={book.thumbnail}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className={`w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center ${book.thumbnail ? 'hidden' : 'flex'}`}
              >
                <BookOpen className="h-8 w-8 text-white" />
              </div>
            </div>
          </Link>

          {/* Book Info */}
          <div className="flex-1 min-w-0">
            <Link to={`/books/${book._id}/read`} onClick={handleReadClick}>
              <h3 className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors line-clamp-2">
                {book.title}
              </h3>
            </Link>
            
            <p className="text-sm text-gray-600 mt-1">by {book.author}</p>
            
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
              <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded-full text-xs font-medium">
                {book.category}
              </span>
              <div className="flex items-center space-x-1">
                <Eye className="h-4 w-4" />
                <span>{book.viewCount || 0}</span>
              </div>
            </div>

            <p className="text-gray-600 mt-2 line-clamp-2">
              {book.summary}
            </p>

            {/* Uploader Info */}
            {book.uploadedBy && (
              <div className="flex items-center space-x-2 mt-3">
                {book.uploadedBy.profilePicture ? (
                  <img
                    src={book.uploadedBy.profilePicture}
                    alt={book.uploadedBy.username}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
                    <User className="h-3 w-3 text-gray-600" />
                  </div>
                )}
                <span className="text-sm text-gray-500">
                  Uploaded by {book.uploadedBy.username}
                </span>
              </div>
            )}
          </div>

          {/* Actions row */}
          <div className="w-full mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleLike}
                className={`p-2 rounded-full transition-colors ${
                  isLiked
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={handleCommentClick}
                className="p-2 rounded-full transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                title="Comment"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); if (user) setIsShareOpen(true); }}
                className="p-2 rounded-full transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                title="Share"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={handleBookmark}
              className={`p-2 rounded-full transition-colors ${
                isBookmarked
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid view (default) in Instagram-like order
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="card overflow-hidden group w-full max-w-xl mx-auto">
      {/* Header: Username */}
      {book.uploadedBy && (
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div
            className="flex items-center gap-2 cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={(e) => { e.preventDefault(); navigate(`/user/${book.uploadedBy.username}`); }}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/user/${book.uploadedBy.username}`); }}
          >
            {book.uploadedBy.profilePicture ? (
              <img
                src={book.uploadedBy.profilePicture}
                alt={book.uploadedBy.username}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">{book.uploadedBy.username}</span>
              {book.createdAt && (
                <span className="text-xs text-gray-500">{new Date(book.createdAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
          {user && book.uploadedBy._id !== user._id && (
            <button
              onClick={async (e) => {
                e.preventDefault();
                if (!user) return;
                try {
                  setIsFollowing((prev) => !prev);
                  if (isFollowing) {
                    await api.post(`/users/unfollow/${book.uploadedBy._id}`);
                  } else {
                    await api.post(`/users/follow/${book.uploadedBy._id}`);
                  }
                  dispatch(getCurrentUser());
                } catch (_) {
                  setIsFollowing((prev) => !prev);
                }
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                isFollowing ? 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200' : 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
          {user && book.uploadedBy._id === user._id && (
            <button
              onClick={async (e) => {
                e.preventDefault();
                if (!confirm('Delete this book? This action cannot be undone.')) return;
                try {
                  await api.delete(`/books/${book._id}`);
                  toast.success('Book deleted successfully');
                  window.location.reload();
                } catch (error) {
                  console.error('Delete error:', error);
                  toast.error('Failed to delete book');
                }
              }}
              className="px-3 py-1 rounded-full text-xs font-medium border border-red-600 text-red-600 hover:bg-red-50"
              title="Delete this book"
            >
              Delete
            </button>
          )}
          {user && user.role === 'admin' && (
            <>
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    if (book.isAdminShared) {
                      await bookService.unshareBookGlobally(book._id);
                      toast.success('Book unshared globally');
                    } else {
                      await bookService.shareBookGlobally(book._id);
                      toast.success('Book shared globally');
                    }
                    // Refresh the page to update the UI
                    window.location.reload();
                  } catch (error) {
                    toast.error('Failed to update book sharing status');
                    console.error('Error updating book sharing:', error);
                  }
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  book.isAdminShared 
                    ? 'border-orange-600 text-orange-600 hover:bg-orange-50' 
                    : 'border-green-600 text-green-600 hover:bg-green-50'
                }`}
                title={book.isAdminShared ? 'Unshare globally' : 'Share globally'}
              >
                {book.isAdminShared ? (
                  <>
                    <Globe2 className="h-3 w-3 inline mr-1" />
                    Unshare
                  </>
                ) : (
                  <>
                    <Globe className="h-3 w-3 inline mr-1" />
                    Share
                  </>
                )}
              </button>
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await bookService.toggleGlobalVisibility(book._id);
                    toast.success(`Book ${book.isGlobal ? 'hidden from' : 'made visible to'} all users`);
                    // Refresh the page to update the UI
                    window.location.reload();
                  } catch (error) {
                    toast.error('Failed to update global visibility');
                    console.error('Error updating global visibility:', error);
                  }
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  book.isGlobal 
                    ? 'border-blue-600 text-blue-600 hover:bg-blue-50' 
                    : 'border-gray-600 text-gray-600 hover:bg-gray-50'
                }`}
                title={book.isGlobal ? 'Hide from all users' : 'Make visible to all users'}
              >
                {book.isGlobal ? (
                  <>
                    <EyeOff className="h-3 w-3 inline mr-1" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 inline mr-1" />
                    Show
                  </>
                )}
              </button>
            </>
          )}
          </div>
        </div>
      )}

      {/* Book first page (thumbnail) */}
      <Link to={`/books/${book._id}/read`} onClick={handleReadClick} className="block">
        <div className={`relative w-full ${imageWrapperClass} overflow-hidden bg-gray-50 rounded-lg`}>
          {book.thumbnail ? (
            <img
              src={book.thumbnail.replace('/upload/', '/upload/f_auto,q_auto,w_600/')}
              alt={book.title}
              className={`w-full h-full ${isProfileView ? 'object-contain' : 'object-cover'}`}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className={`w-full ${isProfileView ? 'h-56' : 'aspect-[3/4]'} bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center ${book.thumbnail ? 'hidden' : 'flex'}`}>
            <BookOpen className="h-16 w-16 text-white" />
          </div>
          {/* Overlay badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            {book.category && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-white/90 text-gray-800 shadow-sm">
                {book.category}
              </span>
            )}
            {book.isAdminShared && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/90 text-white shadow-sm flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Admin Shared
              </span>
            )}
          </div>
          <div className="absolute bottom-3 right-3 flex items-center gap-2 px-2 py-1 rounded-full bg-black/50 text-white text-xs">
            <Eye className="h-3 w-3" />
            <span>{book.viewCount || 0}</span>
          </div>
        </div>
      </Link>

      {/* Actions: icons only (Like, Comment, Share | Bookmark at right) */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleLike}
            className={`p-2 rounded-full transition-colors ${
              isLiked
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={handleCommentClick}
            className="p-2 rounded-full transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
            title="Comment"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); if (user) setIsShareOpen(true); }}
            className="p-2 rounded-full transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
            title="Share"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={handleBookmark}
          className={`p-2 rounded-full transition-colors ${
            isBookmarked
              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        >
          <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>
      {isShareOpen && (
        <ShareModal book={book} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
      )}

      {/* Meta: likes/views and caption */}
      <div className="px-4 pb-4 space-y-2">
        <div className="flex items-center gap-4 text-sm text-gray-700">
          <span className="font-medium">{likeCount} likes</span>
          <span className="flex items-center gap-1 text-gray-500">
            <Eye className="h-4 w-4" /> {book.viewCount || 0}
          </span>
        </div>
        <div className="text-sm"><span className="font-medium line-clamp-1">{book.title}</span>{book.author ? <span className="text-gray-600"> by {book.author}</span> : null}</div>
        <div className="text-sm text-primary-600 cursor-pointer" onClick={handleCommentClick}>
          {commentCount > 0 ? `${commentCount} comments` : 'No comments'}
        </div>
      </div>
    </motion.div>
  );
};

export default BookCard;
