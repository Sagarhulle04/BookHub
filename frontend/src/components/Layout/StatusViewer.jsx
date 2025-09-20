import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import statusService from '../../services/statusService';

const StatusViewer = ({ items, index, onClose, onChange, onDeleted, groupItems, itemIndex, onNextItem, onPrevItem, onNextGroup, onPrevGroup }) => {
  const current = Array.isArray(groupItems) ? groupItems[itemIndex] : items[index];
  const { user } = useSelector((state) => state.auth);
  const isOwner = (() => {
    if (!user) return false;
    const myId = String(user._id || user.id || '');
    const u = current?.user;
    if (!u) return false;
    // user can be populated object or just an id string
    if (typeof u === 'string') return String(u) === myId;
    if (typeof u === 'object') {
      if (u._id) return String(u._id) === myId;
      if (u.id) return String(u.id) === myId;
      // fallback: compare username if available
      if (u.username && user.username) return String(u.username) === String(user.username);
    }
    // also support schemas that expose userId on root
    if (current.userId) return String(current.userId) === myId;
    return false;
  })();

  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onChange(Math.min(items.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onChange(Math.max(0, index - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, items.length, onClose, onChange]);

  // Mark current status as viewed when opened and when changing within group
  useEffect(() => {
    if (!current?._id) return;
    statusService.markViewed(current._id).catch(() => {});
  }, [current?._id]);

  // Reset loading/progress when item changes
  useEffect(() => {
    setIsLoading(true);
    setProgress(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, [current?._id]);

  // Smooth progress for videos via RAF (fallback to onTimeUpdate as well)
  useEffect(() => {
    if (current?.mediaType !== 'video') return;
    const v = videoRef.current;
    if (!v) return;

    let isCancelled = false;
    const tick = () => {
      if (isCancelled) return;
      const dur = v.duration || 0;
      const cur = v.currentTime || 0;
      if (dur > 0) setProgress(Math.min(100, (cur / dur) * 100));
      rafRef.current = requestAnimationFrame(tick);
    };

    // Start loop on play or if already playing
    const start = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };

    v.addEventListener('play', start);
    v.addEventListener('pause', stop);
    v.addEventListener('ended', stop);

    if (!v.paused) start();

    return () => {
      isCancelled = true;
      v.removeEventListener('play', start);
      v.removeEventListener('pause', stop);
      v.removeEventListener('ended', stop);
      stop();
    };
  }, [current?.mediaType, current?._id]);


  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-[340px] h-[610px] bg-black rounded-md border border-gray-700 overflow-hidden flex items-center justify-center">
        {/* Progress segments */}
        {Array.isArray(groupItems) && groupItems.length > 0 && (
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-3">
            {groupItems.map((_, i) => (
              <div key={i} className="h-1 flex-1 bg-white/30 rounded">
                <div className="h-full bg-white rounded transition-[width] duration-100 ease-linear" style={{ width: i < itemIndex ? '100%' : i === itemIndex ? `${progress}%` : '0%' }} />
              </div>
            ))}
          </div>
        )}

        {/* Media */}
        {current.mediaType === 'video' ? (
          <video
            ref={videoRef}
            src={current.mediaUrl}
            className="w-full h-full object-contain"
            autoPlay
            muted
            onLoadedData={() => { setIsLoading(false); setProgress(0); }}
            onTimeUpdate={() => {
              const v = videoRef.current;
              if (!v || !v.duration) return;
              setProgress(Math.min(100, (v.currentTime / v.duration) * 100));
            }}
            onEnded={() => { if (onNextItem && Array.isArray(groupItems) && itemIndex < groupItems.length - 1) onNextItem(); else if (onNextGroup) onNextGroup(); }}
          />
        ) : (
          <AutoAdvanceImage
            src={current.mediaUrl}
            alt={current.user?.username}
            durationMs={5000}
            onReady={() => { setIsLoading(false); setProgress(0); }}
            onProgress={(p) => setProgress(p)}
            onAdvance={() => { if (onNextItem && Array.isArray(groupItems) && itemIndex < groupItems.length - 1) onNextItem(); else if (onNextGroup) onNextGroup(); }}
          />
        )}

        <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between text-white text-sm">
          <div className="flex items-center gap-2">
            <img src={current.user?.profilePicture || '/default-avatar.png'} alt={current.user?.username} className="w-8 h-8 rounded-full object-cover" />
            <div className="font-medium">{current.user?.username}</div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded"
                onClick={async () => {
                  try {
                    if (!window.confirm('Delete this status?')) return;
                    await statusService.deleteStatus(current._id);
                    if (typeof onDeleted === 'function') await onDeleted();
                  } finally {
                    onClose();
                  }
                }}
                title="Delete status"
              >
                Delete
              </button>
            )}
            <button className="px-3 py-1 bg-white/20 rounded" onClick={onClose}>Close</button>
          </div>
        </div>
        {/* Navigation: within group and across groups */}
        <button className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-2xl" onClick={() => {
          if (onPrevItem && itemIndex > 0) onPrevItem(); else if (onPrevGroup) onPrevGroup(); else onChange(Math.max(0, index - 1));
        }}>&lsaquo;</button>
        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-2xl" onClick={() => {
          if (onNextItem && Array.isArray(groupItems) && itemIndex < groupItems.length - 1) onNextItem(); else if (onNextGroup) onNextGroup(); else onChange(Math.min(items.length - 1, index + 1));
        }}>&rsaquo;</button>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        
      </div>
    </div>
  );
};

export default StatusViewer;

const AutoAdvanceImage = ({ src, alt, durationMs = 5000, onAdvance, onProgress, onReady }) => {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (typeof onReady === 'function') onReady();
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      if (typeof onProgress === 'function') onProgress(pct);
      if (elapsed >= durationMs) {
        if (typeof onAdvance === 'function') onAdvance();
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, durationMs, onAdvance, onProgress, onReady]);
  return (
    <img src={src} alt={alt} className="w-full h-full object-contain" onLoad={() => setKey((k) => k + 1)} />
  );
};


