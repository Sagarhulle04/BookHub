import { useEffect, useState } from 'react';
import chatService from '../../services/chatService';

const Shared = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await chatService.listSharedRecipients();
        setUsers(data.users || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = (users || []).filter(u => (u.username || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Shared</h1>
        <input className="input-field max-w-xs" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-600">No users to show</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <a key={u._id} href={`/chat/${u.conversationId}`} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-3">
                {u.profilePicture ? (
                  <img src={u.profilePicture} alt={u.username} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300" />
                )}
                <div className="text-sm font-medium">{u.username}</div>
              </div>
              <div className="text-xs text-primary-600">Open Chat</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default Shared;


