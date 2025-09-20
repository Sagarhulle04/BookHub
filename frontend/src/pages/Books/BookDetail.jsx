import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { 
  Heart, 
  Bookmark, 
  Eye, 
  MessageCircle, 
  ArrowLeft, 
  Download,
  Share2,
  Star,
  Calendar,
  User
} from 'lucide-react';
import toast from 'react-hot-toast';

import { getBookById, getBooks } from '../../store/slices/bookSlice';
import { getComments, createComment } from '../../store/slices/commentSlice';
import { toggleLike, checkLike } from '../../store/slices/likeSlice';
import { toggleBookmark, checkBookmark } from '../../store/slices/bookmarkSlice';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import highlightService from '../../services/highlightService';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const BookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  
  // Early return if ID is invalid
  if (!id || id === 'undefined' || id === 'null' || id.trim() === '') {
    console.log('Invalid book ID detected early:', id);
    navigate('/');
    return null;
  }
  
  const { currentBook, books, loading, isLoading, isError, message } = useSelector((state) => state.books);
  const { comments, loading: commentsLoading } = useSelector((state) => state.comments);
  const { user } = useSelector((state) => state.auth);
  const { isLiked } = useSelector((state) => state.likes);
  const { isBookmarked } = useSelector((state) => state.bookmarks);

  // Optimistic UI state for like/bookmark on detail page
  const [likedLocal, setLikedLocal] = useState(false);
  const [bookmarkedLocal, setBookmarkedLocal] = useState(false);

  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [relatedBooks, setRelatedBooks] = useState([]);
  const [viewerWidth, setViewerWidth] = useState(600);
  const viewerRef = useRef(null);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState(null);
  const [highlights, setHighlights] = useState([]);

  // Helper function to check if ID is valid
  const isValidId = () => {
    return id && id !== 'undefined' && id !== 'null' && id.trim() !== '' && id.length > 0;
  };

  useEffect(() => {
    // Only make API calls if we have a valid ID
    if (isValidId()) {
      // Clear current book first to ensure loading state is reset
      dispatch({ type: 'books/clearCurrentBook' });
      dispatch({ type: 'comments/clearComments' });
      
      dispatch(getBookById(id));
      dispatch(getComments({ bookId: id, page: 1 }));
      dispatch(checkLike(id));
      dispatch(checkBookmark(id));
    } else {
      // If ID is invalid, redirect to home page
      navigate('/');
    }
  }, [dispatch, id, navigate]);

  // Auto-open comments if navigated with openComments=1
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openComments') === '1') {
      setShowComments(true);
    }
  }, [location.search]);

  // Sync local optimistic state with store state
  useEffect(() => {
    setLikedLocal(!!isLiked);
  }, [isLiked]);

  useEffect(() => {
    setBookmarkedLocal(!!isBookmarked);
  }, [isBookmarked]);

  useEffect(() => {
    if (currentBook) {
      // Get related books (same category, excluding current book)
      const related = books.filter(
        book => book.category === currentBook.category && book._id !== currentBook._id
      ).slice(0, 4);
      setRelatedBooks(related);
    }
  }, [currentBook, books]);

  useEffect(() => {
    const updateWidth = () => {
      if (viewerRef.current) {
        const w = viewerRef.current.getBoundingClientRect().width;
        // Cap max width for readability
        setViewerWidth(Math.min(Math.max(320, Math.floor(w - 24)), 900));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleLike = async () => {
    if (!user) {
      toast.error('Please login to like books');
      return;
    }
    if (!isValidId()) {
      toast.error('Invalid book ID');
      return;
    }
    // Optimistic toggle
    setLikedLocal(prev => !prev);
    dispatch(toggleLike(id));
  };

  const handleBookmark = async () => {
    if (!user) {
      toast.error('Please login to bookmark books');
      return;
    }
    if (!isValidId()) {
      toast.error('Invalid book ID');
      return;
    }
    // Optimistic toggle
    setBookmarkedLocal(prev => !prev);
    dispatch(toggleBookmark(id));
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to comment');
      return;
    }
    if (!commentText.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    if (!isValidId()) {
      toast.error('Invalid book ID');
      return;
    }

    try {
      await dispatch(createComment({
        bookId: id,
        content: commentText.trim()
      })).unwrap();
      setCommentText('');
      toast.success('Comment added successfully');
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleDownload = () => {
    if (currentBook?._id) {
      const link = document.createElement('a');
      link.href = `/api/books/${currentBook._id}/pdf`;
      link.download = `${currentBook.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentBook?.title,
          text: `Check out this book: ${currentBook?.title}`,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  const handleAsk = async () => {
    if (!qaQuestion.trim() || !currentBook?._id) return;
    try {
      const res = await fetch(`/api/books/${currentBook._id}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: qaQuestion.trim() })
      });
      const data = await res.json();
      setQaAnswer(data);
    } catch (_) {}
  };

  const addHighlight = async (text, page) => {
    if (!user || !currentBook?._id || !text) return;
    try {
      await highlightService.create({ bookId: currentBook._id, pageNumber: page, text });
      const list = await highlightService.listByBook(currentBook._id);
      setHighlights(list || []);
    } catch (_) {}
  };

  useEffect(() => {
    (async () => {
      if (currentBook?._id && user) {
        const list = await highlightService.listByBook(currentBook._id);
        setHighlights(list || []);
      }
    })();
  }, [currentBook?._id, user]);

  const handleDelete = async () => {
    if (!user) {
      toast.error('Please login');
      return;
    }
    const isOwner = currentBook?.uploadedBy?._id === user?._id;
    const isAdmin = user?.role === 'admin';
    if (!isOwner && !isAdmin) {
      toast.error('You are not authorized to delete this book');
      return;
    }
    const ok = window.confirm('Are you sure you want to delete this book? This cannot be undone.');
    if (!ok) return;
    try {
      const res = await fetch(`/api/books/${currentBook._id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || 'Failed to delete');
      }
      toast.success('Book deleted');
      navigate('/');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Delete failed');
    }
  };

  if (!currentBook && (loading || isLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-96 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="space-y-4">
                <div className="h-64 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if we have a valid ID first
  if (!isValidId()) {
    console.log('Invalid book ID detected:', id);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Book ID</h2>
          <p className="text-gray-600 mb-4">The book ID in the URL is not valid.</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Book</h2>
          <p className="text-gray-600 mb-4">{message || 'An error occurred while loading the book.'}</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!currentBook && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Book not found</h2>
          <p className="text-gray-600 mb-4">The book you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </motion.button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Book Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <div className="flex flex-col md:flex-row gap-6">
                {/* Book Cover */}
                <div className="flex-shrink-0">
                  <img
                    src={currentBook.thumbnail?.replace('/upload/', '/upload/f_auto,q_auto,w_480/')} 
                    alt={currentBook.title}
                    className="w-48 h-64 object-cover rounded-lg shadow-lg"
                  />
                </div>

                {/* Book Details */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {currentBook.title}
                    </h1>
                    <p className="text-xl text-gray-600 mb-2">
                      by {currentBook.author}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Eye size={16} />
                        <span>{currentBook.viewCount} views</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar size={16} />
                        <span>{new Date(currentBook.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">
                      {currentBook.category}
                    </span>
                  </div>

                  <p className="text-gray-700 leading-relaxed">
                    {currentBook.summary}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleLike}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        likedLocal
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Heart size={18} fill={likedLocal ? 'currentColor' : 'none'} />
                      <span>Like</span>
                    </button>

                    <button
                      onClick={handleBookmark}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        bookmarkedLocal
                          ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Bookmark size={18} fill={bookmarkedLocal ? 'currentColor' : 'none'} />
                      <span>Bookmark</span>
                    </button>

                    {null}

                    <button
                      onClick={handleShare}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Share2 size={18} />
                      <span>Share</span>
                    </button>

                    {(user && (currentBook?.uploadedBy?._id === user?._id || user?.role === 'admin')) && (
                      <button
                        onClick={handleDelete}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                      >
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* PDF Viewer */}
            {currentBook.pdfUrl && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Read Book</h2>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                      disabled={pageNumber <= 1}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {pageNumber} of {numPages}
                    </span>
                    <button
                      onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                      disabled={pageNumber >= numPages}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div ref={viewerRef} className="border rounded-lg overflow-hidden">
                  <Document
                    file={`/api/books/${currentBook._id}/pdf`}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div className="h-96 flex items-center justify-center">Loading PDF...</div>}
                    error={
                      <div className="h-96 flex flex-col items-center justify-center space-y-3 text-gray-700 p-4">
                        <div className="text-orange-500">PDF Access Issue</div>
                        <div className="text-sm text-center max-w-md">
                          The PDF viewer couldn't load the file. This might be due to file access restrictions.
                        </div>
                        <div className="flex gap-3 mt-4">
                          <a
                            href={currentBook.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                          >
                            Open PDF in New Tab
                          </a>
                          {null}
                          <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            Try Again
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 text-center mt-2">
                          If the inline viewer doesn't work, you can still access the PDF directly.
                        </div>
                      </div>
                    }
                  >
                    <div className="h-[26rem] sm:h-[32rem] md:h-[40rem] lg:h-[48rem] overflow-y-auto" onMouseUp={async () => {
                      const sel = window.getSelection();
                      const text = sel ? sel.toString().trim() : '';
                      if (text && pageNumber) {
                        await addHighlight(text, pageNumber);
                      }
                    }}>
                      {Array.from(new Array(numPages || 0), (el, index) => (
                        <div key={`page_${index + 1}`} className="flex justify-center py-4">
                          <Page
                            pageNumber={index + 1}
                            width={viewerWidth}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                          />
                        </div>
                      ))}
                    </div>
                  </Document>
                </div>
              </motion.div>
            )}

            {/* Q&A */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Ask about this book</h2>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Ask a question (e.g., What is the main idea?)"
                  value={qaQuestion}
                  onChange={(e) => setQaQuestion(e.target.value)}
                />
                <button className="btn-primary" onClick={handleAsk}>Ask</button>
              </div>
              {qaAnswer?.answer && (
                <div className="mt-3 text-gray-800 text-sm">{qaAnswer.answer}</div>
              )}
            </motion.div>

            {/* Comments Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                  <MessageCircle size={20} />
                  <span>Comments ({comments.length})</span>
                </h2>
                <button
                  onClick={() => setShowComments(!showComments)}
                  className="text-primary-600 hover:text-primary-700"
                >
                  {showComments ? 'Hide' : 'Show'} Comments
                </button>
              </div>

              {/* Add Comment Form */}
              {user && (
                <form onSubmit={handleCommentSubmit} className="mb-6">
                  <div className="flex space-x-3">
                    <img
                      src={user.profilePicture || '/default-avatar.png'}
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Write a comment..."
                        className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        rows="3"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={!commentText.trim()}
                        >
                          Post Comment
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* Comments List */}
              {showComments && (
                <div className="space-y-4">
                  {commentsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse">
                          <div className="flex space-x-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                              <div className="h-4 bg-gray-200 rounded w-full"></div>
                              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : comments.length > 0 ? (
                    comments.map((comment) => (
                      <div key={comment._id} className="flex space-x-3">
                        <img
                          src={comment.user.profilePicture || '/default-avatar.png'}
                          alt={comment.user.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-gray-900">
                                {comment.user.username}
                              </span>
                              <span className="text-sm text-gray-500">
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-gray-700">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No comments yet. Be the first to comment!
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Uploader Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="card p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Uploaded by</h3>
              <div className="flex items-center space-x-3">
                <img
                  src={currentBook.uploadedBy?.profilePicture || '/default-avatar.png'}
                  alt={currentBook.uploadedBy?.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <p className="font-medium text-gray-900">
                    {currentBook.uploadedBy?.username}
                  </p>
                  <p className="text-sm text-gray-500">
                    {currentBook.uploadedBy?.followers?.length || 0} followers
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Related Books */}
            {relatedBooks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="card p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Books</h3>
                <div className="space-y-4">
                  {relatedBooks.map((book) => (
                    <div
                      key={book._id}
                      onClick={() => navigate(`/books/${book._id}`)}
                      className="flex space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    >
                      <img
                        src={book.thumbnail}
                        alt={book.title}
                        className="w-16 h-20 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {book.title}
                        </h4>
                        <p className="text-sm text-gray-600 truncate">
                          by {book.author}
                        </p>
                        <p className="text-xs text-gray-500">
                          {book.viewCount} views
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDetail;
