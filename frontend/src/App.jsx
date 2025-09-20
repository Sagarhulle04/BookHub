import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getCurrentUser } from './store/slices/authSlice';
import { getCategories } from './store/slices/bookSlice';

// Components
import Layout from './components/Layout/Layout';
import { lazy } from 'react';
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const CategoriesOnboarding = lazy(() => import('./pages/Onboarding/CategoriesOnboarding'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));
const BookDetail = lazy(() => import('./pages/Books/BookDetail'));
const Search = lazy(() => import('./pages/Search/Search'));
const Profile = lazy(() => import('./pages/Profile/Profile'));
const UserProfile = lazy(() => import('./pages/Profile/UserProfile'));
const ProfileMenu = lazy(() => import('./pages/Profile/ProfileMenu'));
const AdminUploadBook = lazy(() => import('./pages/Admin/UploadBook'));
const UploadBook = lazy(() => import('./pages/Books/UploadBook'));
const ReadBook = lazy(() => import('./pages/Books/ReadBook'));
const LikedBooks = lazy(() => import('./pages/Books/LikedBooks'));
const BookmarkedBooks = lazy(() => import('./pages/Books/BookmarkedBooks'));
const Inbox = lazy(() => import('./pages/Chat/Inbox'));
const Thread = lazy(() => import('./pages/Chat/Thread'));
const Shared = lazy(() => import('./pages/Chat/Shared'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Protected Route Component
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminRoute from './components/Auth/AdminRoute';

function App() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    // Fetch current user once on mount (prevents refresh loop)
    dispatch(getCurrentUser());
    // Get book categories once
    dispatch(getCategories());
  }, [dispatch]);

  return (
    <div className="App">
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding/categories" element={<ProtectedRoute><CategoriesOnboarding /></ProtectedRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected Routes with Layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="books" element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="books/:id" element={<BookDetail />} />
          <Route path="books/:id/read" element={<ReadBook />} />
          <Route path="profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="profile/menu" element={
            <ProtectedRoute>
              <ProfileMenu />
            </ProtectedRoute>
          } />
          <Route path="liked" element={
            <ProtectedRoute>
              <LikedBooks />
            </ProtectedRoute>
          } />
          <Route path="bookmarks" element={
            <ProtectedRoute>
              <BookmarkedBooks />
            </ProtectedRoute>
          } />
          <Route path="user/:username" element={<UserProfile />} />
          <Route path="chat" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
          <Route path="chat/:id" element={<ProtectedRoute><Thread /></ProtectedRoute>} />
          <Route path="chat/shared" element={<ProtectedRoute><Shared /></ProtectedRoute>} />
          
          {/* User Upload Route */}
          <Route path="upload" element={
            <ProtectedRoute>
              <UploadBook />
            </ProtectedRoute>
          } />
          
          {/* Admin Routes */}
          <Route path="admin/upload" element={
            <AdminRoute>
              <AdminUploadBook />
            </AdminRoute>
          } />
        </Route>
        
        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;
