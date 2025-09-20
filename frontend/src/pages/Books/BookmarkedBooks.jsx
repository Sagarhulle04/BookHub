import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getBookmarkedBooks } from '../../store/slices/bookmarkSlice'
import BookCard from '../../components/Books/BookCard'

const BookmarkedBooks = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { bookmarkedBooks, isLoading } = useSelector((state) => state.bookmarks)

  useEffect(() => {
    if (user?._id) {
      dispatch(getBookmarkedBooks({ userId: user._id, page: 1, folder: 'all' }))
    }
  }, [dispatch, user])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Please login</h2>
          <p className="text-gray-600">You need to be logged in to view bookmarks.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Bookmarked Books</h1>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        ) : bookmarkedBooks.length === 0 ? (
          <div className="text-gray-600">You haven't bookmarked any books yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookmarkedBooks.map((book) => (
              <BookCard key={book._id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BookmarkedBooks


