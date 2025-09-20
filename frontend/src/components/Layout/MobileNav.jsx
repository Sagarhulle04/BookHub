import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  Home, 
  Search, 
  BookOpen, 
  Heart, 
  Bookmark, 
  Upload,
  Users,
  Settings,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MobileNav = ({ isOpen, onClose }) => {
  const { user } = useSelector((state) => state.auth);

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: BookOpen, label: 'Books', path: '/books' },
    { icon: Heart, label: 'Liked', path: '/liked' },
    { icon: Bookmark, label: 'Bookmarks', path: '/bookmarks' },
  ];

  const userItems = [
    { icon: Upload, label: 'Upload Book', path: '/upload' },
  ];

  const adminItems = [
    { icon: Upload, label: 'Upload Book', path: '/admin/upload' },
    { icon: Users, label: 'Manage Users', path: '/admin/users' },
    { icon: Settings, label: 'Admin Settings', path: '/admin/settings' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          className="fixed right-0 top-0 h-full w-64 bg-white shadow-lg border-l border-gray-200 z-50 lg:hidden"
        >
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* User Profile Section */}
            {user && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <img
                    src={user.profilePicture}
                    alt={user.username}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      {user.username}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {user.role === 'admin' ? 'Administrator' : 'Member'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Items */}
            <nav className="space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `mobile-nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              ))}

              {/* User Section */}
              {user && (
                <>
                  <div className="pt-4 pb-2">
                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      My Account
                    </h3>
                  </div>
                  {userItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `mobile-nav-link ${isActive ? 'active' : ''}`
                      }
                    >
                      <item.icon className="h-6 w-6" />
                      <span className="text-sm">{item.label}</span>
                    </NavLink>
                  ))}
                </>
              )}

              {/* Admin Section */}
              {user && user.role === 'admin' && (
                <>
                  <div className="pt-4 pb-2">
                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Admin
                    </h3>
                  </div>
                  {adminItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `mobile-nav-link ${isActive ? 'active' : ''}`
                      }
                    >
                      <item.icon className="h-6 w-6" />
                      <span className="text-sm">{item.label}</span>
                    </NavLink>
                  ))}
                </>
              )}
            </nav>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MobileNav;
