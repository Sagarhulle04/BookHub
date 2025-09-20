import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import statusService from '../../services/statusService';
import StatusViewer from './StatusViewer';
import StatusCreationModal from '../Status/StatusCreationModal';

const StatusBar = () => {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [viewerGroupIndex, setViewerGroupIndex] = useState(-1);
  const [viewerItemIndex, setViewerItemIndex] = useState(0);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useSelector((state) => state.auth);

  // Don't render if user is not logged in
  if (!user) {
    return null;
  }

  const load = async () => {
    const data = await statusService.getFeed();
    const now = new Date();
    const list = (Array.isArray(data) ? data : []).filter((s) => {
      const exp = s.expiresAt ? new Date(s.expiresAt) : null;
      if (exp) return exp > now;
      const created = s.createdAt ? new Date(s.createdAt) : null;
      return created ? (now - created) < 24 * 60 * 60 * 1000 : true;
    });
    // Separate unseen and seen; unseen first, seen sorted by createdAt ascending for faint list
    const unseen = [];
    const seen = [];
    for (const s of list) {
      const hasViewed = Array.isArray(s.views) && s.views.map(String).includes(String(user._id));
      if (hasViewed) seen.push(s); else unseen.push(s);
    }
    seen.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const ordered = [...unseen, ...seen];
    setItems(ordered);
    // Group by user
    const byUser = new Map();
    for (const s of ordered) {
      const uid = String(s.user?._id || s.user || '');
      if (!uid) continue;
      if (!byUser.has(uid)) byUser.set(uid, { user: s.user, items: [], hasUnseen: false });
      const entry = byUser.get(uid);
      entry.items.push(s);
      const viewed = Array.isArray(s.views) && s.views.map(String).includes(String(user._id));
      if (!viewed) entry.hasUnseen = true;
    }
    const grouped = Array.from(byUser.values());
    // Sort groups: any with unseen first, preserve item order within
    grouped.sort((a, b) => (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0));
    setGroups(grouped);
  };

  useEffect(() => { load(); }, []);

  // Auto-purge expired statuses from UI without refresh
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setItems((prev) => prev.filter((s) => {
        const exp = s.expiresAt ? new Date(s.expiresAt) : null;
        if (exp) return exp > now;
        const created = s.createdAt ? new Date(s.createdAt) : null;
        return created ? (now - created) < 24 * 60 * 60 * 1000 : true;
      }));
      // Rebuild groups on tick
      setGroups((prev) => {
        const fresh = new Map();
        for (const s of items) {
          const uid = String(s.user?._id || s.user || '');
          if (!uid) continue;
          if (!fresh.has(uid)) fresh.set(uid, { user: s.user, items: [], hasUnseen: false });
          const entry = fresh.get(uid);
          entry.items.push(s);
          const viewed = Array.isArray(s.views) && s.views.map(String).includes(String(user._id));
          if (!viewed) entry.hasUnseen = true;
        }
        return Array.from(fresh.values()).sort((a, b) => (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0));
      });
    };
    const interval = setInterval(tick, 60 * 1000);
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40 mb-4 md:mb-6">
      <div className="w-full mx-0 px-0 py-3 pl-5">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {/* Add status */}
          <button
            onClick={() => setShowCreationModal(true)}
            className="flex-shrink-0 w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 cursor-pointer"
            title="Add status"
          >
            +
          </button>

          {/* Feed */}
          {groups.map((g, gIdx) => {
            const first = g.items[0];
            const hasUnseen = g.items.some(s => !(Array.isArray(s.views) && s.views.map(String).includes(String(user._id))));
            const ringClass = hasUnseen ? 'ring-2 ring-primary-500' : 'ring-0 opacity-60';
            return (
              <div key={String(first.user?._id || first.user)} className="flex-shrink-0 w-16 relative group">
                <div
                  className={`w-16 h-16 rounded-full overflow-hidden ${ringClass}`}
                  onClick={() => { setViewerGroupIndex(gIdx); setViewerItemIndex(0); }} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setViewerGroupIndex(gIdx); setViewerItemIndex(0); } }}
                > 
                  <img
                    src={first.user?.profilePicture || '/default-avatar.png'}
                    alt={first.user?.username}
                    className="w-full h-full object-cover"
                    title={(first.user?.username || 'Status')}
                  />
                </div>
                {(String(first.user?._id || first.user || '') === String(user._id || user.id || '')) && (
                  <button
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-600 text-white text-xs hidden group-hover:flex items-center justify-center shadow"
                    title="Delete status"
                    onClick={async (e) => { e.stopPropagation(); if (!window.confirm('Delete this status?')) return; try { await statusService.deleteStatus(first._id); await load(); } catch (_) {} }}
                  >
                    ×
                  </button>
                )}
                <div className={`mt-1 text-[11px] text-center truncate ${hasUnseen ? 'text-gray-700' : 'text-gray-400'}`} title={first.user?.username}>
                  {first.user?.username || 'User'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {viewerGroupIndex >= 0 && (
        <StatusViewer
          items={groups}
          index={viewerGroupIndex}
          groupItems={groups[viewerGroupIndex]?.items || []}
          itemIndex={viewerItemIndex}
          onNextItem={() => setViewerItemIndex((i) => i + 1)}
          onPrevItem={() => setViewerItemIndex((i) => Math.max(0, i - 1))}
          onNextGroup={() => { setViewerGroupIndex((g) => Math.min(groups.length - 1, g + 1)); setViewerItemIndex(0); }}
          onPrevGroup={() => { setViewerGroupIndex((g) => Math.max(0, g - 1)); setViewerItemIndex(0); }}
          onClose={() => { setViewerGroupIndex(-1); setViewerItemIndex(0); }}
          onChange={() => {}}
          onDeleted={async () => { await load(); }}
        />
      )}
      
      {/* Status Creation Modal */}
      {showCreationModal && (
        <StatusCreationModal
          isOpen={showCreationModal}
          onClose={() => setShowCreationModal(false)}
          onSuccess={() => {
            load(); // Refresh the status feed
            setShowCreationModal(false);
          }}
        />
      )}
    </div>
  );
};

export default StatusBar;


