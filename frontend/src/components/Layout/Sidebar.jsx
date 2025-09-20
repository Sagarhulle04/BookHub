import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  Home, 
  Search, 
  BookOpen, 
  Heart, 
  Bookmark, 
  Upload,
  Users,
  Settings
} from 'lucide-react';
import { motion } from 'framer-motion';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useSelector((state) => state.auth);
  const location = useLocation();
  
  // Check if status bar should be shown (only when user is logged in and on home page)
  const showStatusBar = user && location.pathname === '/';

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

  if (!isOpen) return null;

  return (
    <motion.aside
      initial={{ x: -256 }}
      animate={{ x: 0 }}
      exit={{ x: -256 }}
      className={`fixed left-0 h-full w-64 bg-white shadow-lg border-r border-gray-200 z-30 overflow-hidden flex flex-col ${showStatusBar ? 'top-20' : 'top-0'}`}
    >
      <div className="p-4 flex-1 overflow-hidden">
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
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* User Section */}
          {user && (
            <>
              <div className="pt-4 pb-2">
                <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  My Account
                </h3>
              </div>
              {userItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''}`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}

          {/* Admin Section */}
          {user && user.role === 'admin' && (
            <>
              <div className="pt-4 pb-2">
                <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Admin
                </h3>
              </div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''}`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
