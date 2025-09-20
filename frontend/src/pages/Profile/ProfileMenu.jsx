import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Heart, Bookmark, LogOut, ChevronLeft } from 'lucide-react';
import { logout } from '../../store/slices/authSlice';

const ProfileMenu = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  return (
    <div className="bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 flex flex-col h-[calc(100vh-56px)] overflow-hidden">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate(-1)} className="p-2 mr-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">@{user?.username}</h1>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 divide-y flex-none">
          <button
            onClick={() => navigate('/liked')}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <Heart className="h-5 w-5 text-gray-600" />
            <span className="text-gray-800">Liked Books</span>
          </button>

          <button
            onClick={() => navigate('/bookmarks')}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <Bookmark className="h-5 w-5 text-gray-600" />
            <span className="text-gray-800">Bookmarked Books</span>
          </button>
        </div>

        <div className="mt-auto pt-6 flex justify-end flex-none">
          <button
            onClick={async () => {
              try {
                await dispatch(logout()).unwrap();
                navigate('/login');
              } catch (_) {}
            }}
            className="flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-red-50"
          >
            <LogOut className="h-5 w-5 text-red-600" />
            <span className="text-red-600">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileMenu;


