import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import userService from '../../services/userService';
import axios from 'axios';

const SuggestedFollows = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    // Only fetch suggestions if user is authenticated
    if (!user) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await userService.getFollowSuggestions();
        setUsers(res || []);
      } catch (err) {
        // Gracefully ignore if endpoint is not available or user not authenticated
        setUsers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) return <div className="text-sm text-gray-600">Loading suggestions...</div>;
  if (!users || users.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold text-gray-800 mb-2">Who to follow</h4>
      <div className="space-y-2">
        {users.slice(0, 5).map((u) => (
          <div key={u._id} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <img src={u.profilePicture || '/default-avatar.png'} alt={u.username} className="w-8 h-8 rounded-full object-cover" />
              <div className="text-sm font-medium truncate">{u.username}</div>
            </div>
            <button
              className="px-3 py-1 rounded-full text-xs font-medium bg-primary-600 text-white hover:bg-primary-700"
              onClick={async () => {
                await axios.post(`/api/users/follow/${u._id}`);
                setUsers((prev) => prev.filter((x) => x._id !== u._id));
              }}
            >
              Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuggestedFollows;


