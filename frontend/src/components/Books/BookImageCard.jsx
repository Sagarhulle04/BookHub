import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const BookImageCard = ({ book }) => {
  if (!book) return null;

  const href = `/books/${book._id}/read`;

  return (
    <Link to={href} style={{ breakInside: 'avoid' }}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="relative mb-4 overflow-hidden rounded-xl bg-gray-100 shadow-sm hover:shadow-md transition-shadow"
     >
        {book.thumbnail ? (
          <img
            src={book.thumbnail}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div className={`w-full aspect-[3/4] bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center ${book.thumbnail ? 'hidden' : 'flex'}`}>
          <span className="text-white font-medium px-3 text-center line-clamp-2">{book.title}</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 hover:opacity-100 transition-opacity"></div>
        <div className="absolute bottom-2 left-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
          <div className="text-white text-sm font-medium line-clamp-1">{book.title}</div>
          {book.author ? (
            <div className="text-white/80 text-xs line-clamp-1">{book.author}</div>
          ) : null}
        </div>
      </motion.div>
    </Link>
  );
};

export default BookImageCard;


