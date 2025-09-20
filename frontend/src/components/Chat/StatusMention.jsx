import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Image, X, AtSign } from 'lucide-react';
import statusService from '../../services/statusService';

const StatusMention = ({ onSelect, onClose }) => {
  const { user } = useSelector((state) => state.auth);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTaggedBy, setShowTaggedBy] = useState(false);
  const [taggedByUsers, setTaggedByUsers] = useState([]);
  const modalRef = useRef(null);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const response = await statusService.getFeed();
        setStatuses(response);
        
        // Find statuses where current user is tagged
        const taggedStatuses = response.filter(status => 
          status.taggedUsers && status.taggedUsers.some(taggedUser => 
            taggedUser._id === user._id || taggedUser === user._id
          )
        );
        
        // Set tagged statuses directly instead of extracting users
        setTaggedByUsers(taggedStatuses);
      } catch (error) {
        console.error('Error fetching statuses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatuses();
  }, [user._id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredStatuses = statuses.filter(status => 
    status.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (status.text && status.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleStatusSelect = (status) => {
    onSelect(status);
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6">
          <div className="text-center">Loading statuses...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div ref={modalRef} className="bg-white rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Share Status</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {taggedByUsers.length > 0 && (
          <div className="p-4 border-b bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <AtSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">You were tagged in these statuses</span>
            </div>
            <p className="text-xs text-blue-600 mb-2">Click to share the status and re-mention:</p>
            <div className="space-y-2">
              {taggedByUsers.map((status) => (
                <div
                  key={status._id}
                  className="flex items-center gap-3 p-2 rounded-lg border border-blue-200"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center">
                    {status.mediaType === 'image' ? (
                      <img
                        src={status.mediaUrl}
                        alt="Status"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <img
                        src={status.user.profilePicture || '/default-avatar.png'}
                        alt={status.user.username}
                        className="w-4 h-4 rounded-full"
                      />
                      <span className="text-xs font-medium text-blue-800">
                        {status.user.username} tagged you
                      </span>
                    </div>
                    
                    {status.text && (
                      <p className="text-xs text-blue-600 truncate">
                        {status.text}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleStatusSelect(status)}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                    >
                      Share
                    </button>
                    <button
                      onClick={() => {
                        // Create a re-mention status with the original image
                        const reMentionStatus = {
                          ...status,
                          isReMention: true,
                          originalStatusId: status._id
                        };
                        onSelect(reMentionStatus);
                      }}
                      className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                    >
                      Re-mention
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search statuses..."
            className="w-full p-2 border border-gray-300 rounded-lg mb-4"
          />
          
          <div className="max-h-96 overflow-y-auto space-y-3">
            {filteredStatuses.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {searchQuery ? 'No statuses found' : 'No statuses available'}
              </div>
            ) : (
              filteredStatuses.map((status) => (
                <div
                  key={status._id}
                  onClick={() => handleStatusSelect(status)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center">
                    {status.mediaType === 'image' ? (
                      <img
                        src={status.mediaUrl}
                        alt="Status"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <img
                        src={status.user.profilePicture || '/default-avatar.png'}
                        alt={status.user.username}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {status.user.username}
                      </span>
                    </div>
                    
                    {status.text && (
                      <p className="text-sm text-gray-600 truncate">
                        {status.text}
                      </p>
                    )}
                    
                    <p className="text-xs text-gray-400">
                      {new Date(status.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusMention;
