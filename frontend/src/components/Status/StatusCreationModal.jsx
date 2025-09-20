import { useState, useRef, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { X, Crop, Palette, Type, AtSign, Music, Smile, Send, RotateCcw } from 'lucide-react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import EmojiPicker from 'emoji-picker-react';
import statusService from '../../services/statusService';
import userService from '../../services/userService';

const StatusCreationModal = ({ isOpen, onClose, onSuccess, preTaggedUser = null }) => {
  const { user } = useSelector((state) => state.auth);
  const [step, setStep] = useState(1); // 1: upload, 2: customize, 3: preview
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [crop, setCrop] = useState({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
  const [croppedImageUrl, setCroppedImageUrl] = useState('');
  const [showCrop, setShowCrop] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  
  // Customization options
  const [textOverlay, setTextOverlay] = useState('');
  const [textPosition, setTextPosition] = useState({ x: 192, y: 336 });
  const [textSize, setTextSize] = useState('medium');
  const [taggedUsers, setTaggedUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMusic, setSelectedMusic] = useState('');
  const [emojis, setEmojis] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Pre-populate tagged users if provided
  useEffect(() => {
    if (preTaggedUser && !taggedUsers.some(u => u._id === preTaggedUser._id)) {
      setTaggedUsers([preTaggedUser]);
    }
  }, [preTaggedUser]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setImageUrl(url);
      setStep(2);
    }
  };

  const onImageLoad = useCallback((img) => {
    imgRef.current = img;
  }, []);

  const getCroppedImg = (image, crop, fileName) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pixelRatio = window.devicePixelRatio;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = crop.width * pixelRatio;
    canvas.height = crop.height * pixelRatio;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleCrop = async () => {
    if (imgRef.current && crop.width && crop.height) {
      const croppedImageBlob = await getCroppedImg(imgRef.current, crop, 'cropped-image.jpg');
      const croppedUrl = URL.createObjectURL(croppedImageBlob);
      setCroppedImageUrl(croppedUrl);
      setShowCrop(false);
    }
  };

  const handleUserSearch = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await userService.searchUsers(query, 1);
      setSearchResults(results.users || []);
    } catch (error) {
      console.error('User search error:', error);
    }
  };

  const addTaggedUser = (user) => {
    if (!taggedUsers.find(u => u._id === user._id)) {
      setTaggedUsers([...taggedUsers, user]);
    }
    setUserSearchQuery('');
    setSearchResults([]);
    setShowUserSearch(false);
  };

  const removeTaggedUser = (userId) => {
    setTaggedUsers(taggedUsers.filter(u => u._id !== userId));
  };

  const addEmoji = (emoji) => {
    setEmojis([...emojis, { emoji, id: Date.now(), x: 60 + (emojis.length * 36), y: 60 }]);
    setShowEmojiPicker(false);
  };

  const removeEmoji = (id) => {
    setEmojis(emojis.filter(e => e.id !== id));
  };

  const handleTextDrag = (e) => {
    if (!isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Constrain to preview area
    const constrainedX = Math.max(60, Math.min(rect.width - 60, x));
    const constrainedY = Math.max(40, Math.min(rect.height - 40, y));
    
    setTextPosition({ x: constrainedX, y: constrainedY });
  };

  const handleTextDragStart = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left - textPosition.x,
      y: e.clientY - rect.top - textPosition.y
    });
  };

  const handleTextDragEnd = () => {
    setIsDragging(false);
  };

  const handleEmojiDrag = (e, emojiId) => {
    if (!isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update emoji position
    setEmojis(emojis.map(emoji => 
      emoji.id === emojiId 
        ? { ...emoji, x: Math.max(30, Math.min(rect.width - 30, x)), y: Math.max(30, Math.min(rect.height - 30, y)) }
        : emoji
    ));
  };

  const handleEmojiDragStart = (e, emojiId) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleEmojiDragEnd = () => {
    setIsDragging(false);
  };

  const generateStatusImage = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // Increase canvas size for better quality and larger status
    canvas.width = 600;
    canvas.height = 600;

    // Add main image (no background)
    const img = new Image();
    img.onload = () => {
      // Draw image to fill the entire canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Add text overlay at dragged position (scale position for larger canvas)
      if (textOverlay) {
        const scaledFontSize = textSize === 'small' ? '20px' : textSize === 'medium' ? '28px' : '36px';
        ctx.font = `bold ${scaledFontSize} Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Scale text position for larger canvas
        const scaledX = (textPosition.x / 384) * 600;
        const scaledY = (textPosition.y / 384) * 600;
        
        // Draw background rectangle for better visibility
        const textMetrics = ctx.measureText(textOverlay);
        const textWidth = textMetrics.width;
        const textHeight = parseInt(scaledFontSize);
        const padding = 8;
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(
          scaledX - textWidth/2 - padding, 
          scaledY - textHeight/2 - padding, 
          textWidth + padding*2, 
          textHeight + padding*2
        );
        
        // Draw text with stroke for better visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(textOverlay, scaledX, scaledY);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(textOverlay, scaledX, scaledY);
      }
      
      // Add emojis (scaled for larger canvas)
      emojis.forEach((emojiObj) => {
        ctx.font = '36px Arial';
        const x = emojiObj.x ? (emojiObj.x / 384) * 600 : 60;
        const y = emojiObj.y ? (emojiObj.y / 384) * 600 : 60;
        ctx.fillText(emojiObj.emoji, x, y);
      });
      
      // Convert to blob with better quality
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setCroppedImageUrl(url);
        setStep(3);
      }, 'image/jpeg', 0.85); // Better quality for better appearance
    };
    
    if (croppedImageUrl) {
      img.src = croppedImageUrl;
    } else if (imageUrl) {
      img.src = imageUrl;
    }
  };

  const handlePublish = async () => {
    try {
      setIsUploading(true);
      
      // First generate the final image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 600;
      canvas.height = 600;

      const img = new Image();
      img.onload = async () => {
        // Draw image to fill the entire canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Add text overlay at dragged position (scale position for larger canvas)
        if (textOverlay) {
          const scaledFontSize = textSize === 'small' ? '20px' : textSize === 'medium' ? '28px' : '36px';
          ctx.font = `bold ${scaledFontSize} Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Scale text position for larger canvas
          const scaledX = (textPosition.x / 384) * 600;
          const scaledY = (textPosition.y / 384) * 600;
          
          // Draw background rectangle for better visibility
          const textMetrics = ctx.measureText(textOverlay);
          const textWidth = textMetrics.width;
          const textHeight = parseInt(scaledFontSize);
          const padding = 8;
          
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(
            scaledX - textWidth/2 - padding, 
            scaledY - textHeight/2 - padding, 
            textWidth + padding*2, 
            textHeight + padding*2
          );
          
          // Draw text with stroke for better visibility
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4;
          ctx.strokeText(textOverlay, scaledX, scaledY);
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(textOverlay, scaledX, scaledY);
        }
        
        // Add emojis (scaled for larger canvas)
        emojis.forEach((emojiObj) => {
          ctx.font = '36px Arial';
          const x = emojiObj.x ? (emojiObj.x / 384) * 600 : 60;
          const y = emojiObj.y ? (emojiObj.y / 384) * 600 : 60;
          ctx.fillText(emojiObj.emoji, x, y);
        });
        
        // Convert to blob and upload with better quality
        canvas.toBlob(async (blob) => {
          try {
            const formData = new FormData();
            formData.append('media', blob, 'status.jpg');
            formData.append('mediaType', 'image');
            formData.append('text', textOverlay);
            formData.append('taggedUsers', JSON.stringify(taggedUsers.map(u => u._id)));
            formData.append('emojis', JSON.stringify(emojis));
            
            await statusService.createStatus(formData);
            onSuccess();
            onClose();
            resetModal();
          } catch (error) {
            console.error('Error creating status:', error);
          } finally {
            setIsUploading(false);
          }
        }, 'image/jpeg', 0.85); // Better quality for better appearance
      };
      
      if (croppedImageUrl) {
        img.src = croppedImageUrl;
      } else if (imageUrl) {
        img.src = imageUrl;
      }
    } catch (error) {
      console.error('Error creating status:', error);
      setIsUploading(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setFile(null);
    setImageUrl('');
    setCroppedImageUrl('');
    setShowCrop(false);
    setTextOverlay('');
    setTextPosition({ x: 192, y: 336 });
    setTaggedUsers([]);
    setEmojis([]);
    setIsUploading(false);
  };

  useEffect(() => {
    if (userSearchQuery) {
      const timeoutId = setTimeout(() => handleUserSearch(userSearchQuery), 300);
      return () => clearTimeout(timeoutId);
    }
  }, [userSearchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Create Status</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row h-[calc(95vh-80px)]">
          {/* Left Panel - Preview */}
          <div className="flex-1 p-3 sm:p-6 flex items-center justify-center bg-gray-50">
            <div className="w-80 h-80 sm:w-96 sm:h-96 relative rounded-2xl overflow-hidden shadow-lg">
              {step === 1 && (
                <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Send className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">Upload an image to get started</p>
                  </div>
                </div>
              )}
              
              {(step === 2 || step === 3) && (
                <div 
                  className="w-full h-full relative overflow-hidden"
                  onMouseMove={handleTextDrag}
                  onMouseUp={handleTextDragEnd}
                  onMouseLeave={handleTextDragEnd}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = touch.clientX - rect.left;
                    const y = touch.clientY - rect.top;
                    
                    if (isDragging) {
                      const constrainedX = Math.max(60, Math.min(rect.width - 60, x));
                      const constrainedY = Math.max(40, Math.min(rect.height - 40, y));
                      setTextPosition({ x: constrainedX, y: constrainedY });
                    }
                  }}
                  onTouchEnd={handleTextDragEnd}
                >
                  {croppedImageUrl ? (
                    <img 
                      src={croppedImageUrl} 
                      alt="Status preview" 
                      className="w-full h-full object-cover object-center"
                      style={{ minWidth: '100%', minHeight: '100%' }}
                    />
                  ) : imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt="Status preview" 
                      className="w-full h-full object-cover object-center"
                      style={{ minWidth: '100%', minHeight: '100%' }}
                    />
                  ) : null}
                  
                  {textOverlay && (
                    <div 
                      className="absolute text-center px-4 cursor-move select-none"
                      style={{ 
                        left: `${textPosition.x}px`, 
                        top: `${textPosition.y}px`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: textSize === 'small' ? '16px' : textSize === 'medium' ? '20px' : '24px',
                        color: '#ffffff',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9)',
                        zIndex: 10,
                        fontWeight: 'bold',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        padding: '4px 8px',
                        borderRadius: '4px'
                      }}
                      onMouseDown={handleTextDragStart}
                      onTouchStart={handleTextDragStart}
                    >
                      {textOverlay}
                    </div>
                  )}
                  
                  {emojis.map((emojiObj) => (
                    <div 
                      key={emojiObj.id}
                      className="absolute text-2xl cursor-move select-none"
                      style={{ 
                        left: `${emojiObj.x || 20}px`, 
                        top: `${emojiObj.y || 20}px`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10
                      }}
                      onMouseDown={(e) => handleEmojiDragStart(e, emojiObj.id)}
                      onTouchStart={(e) => handleEmojiDragStart(e, emojiObj.id)}
                    >
                      {emojiObj.emoji}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Controls */}
          <div className="w-full sm:w-80 border-t sm:border-t-0 sm:border-l p-4 sm:p-6 overflow-y-auto">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Upload Image</h3>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-lg font-medium"
                >
                  📷 Choose Image
                </button>
                <p className="text-sm text-gray-500 text-center">
                  Select an image from your device to create a status
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Customize</h3>
                  <button
                    onClick={() => setShowCrop(!showCrop)}
                    className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Crop className="w-4 h-4" />
                    {showCrop ? 'Hide Crop' : 'Crop Image'}
                  </button>
                </div>

                {showCrop && imageUrl && (
                  <div className="space-y-4">
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={handleCrop}
                      aspect={1}
                    >
                      <img
                        ref={onImageLoad}
                        alt="Crop me"
                        src={imageUrl}
                        style={{ maxWidth: '100%', maxHeight: '200px' }}
                      />
                    </ReactCrop>
                    <button
                      onClick={handleCrop}
                      className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Apply Crop
                    </button>
                  </div>
                )}


                {/* Text Overlay */}
                <div>
                  <label className="block text-sm font-medium mb-2">Text Overlay</label>
                  <input
                    type="text"
                    value={textOverlay}
                    onChange={(e) => setTextOverlay(e.target.value)}
                    placeholder="Add text..."
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                  {textOverlay && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-gray-500">Drag the text in the preview to position it</p>
                      <div className="flex gap-2">
                        {['small', 'medium', 'large'].map((size) => (
                          <button
                            key={size}
                            onClick={() => setTextSize(size)}
                            className={`px-2 py-1 text-xs rounded ${
                              textSize === size ? 'bg-primary-600 text-white' : 'bg-gray-100'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Emojis */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      <Smile className="w-4 h-4" />
                      Add Emojis
                    </button>
                  </div>
                  {showEmojiPicker && (
                    <div className="absolute z-20 bg-white border rounded-lg shadow-lg p-2 max-h-64 overflow-y-auto">
                      <EmojiPicker onEmojiClick={(e) => addEmoji(e.emoji)} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {emojis.map((emojiObj) => (
                      <div key={emojiObj.id} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1">
                        <span>{emojiObj.emoji}</span>
                        <button
                          onClick={() => removeEmoji(emojiObj.id)}
                          className="text-gray-500 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {emojis.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Drag emojis in the preview to position them</p>
                  )}
                </div>

                {/* User Tagging */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setShowUserSearch(!showUserSearch)}
                      className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      <AtSign className="w-4 h-4" />
                      Tag People
                    </button>
                  </div>
                  {showUserSearch && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Search users..."
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      />
                      {searchResults.length > 0 && (
                        <div className="max-h-32 overflow-y-auto border rounded-lg">
                          {searchResults.map((user) => (
                            <button
                              key={user._id}
                              onClick={() => addTaggedUser(user)}
                              className="w-full p-2 text-left hover:bg-gray-100 flex items-center gap-2"
                            >
                              <img
                                src={user.profilePicture || '/default-avatar.png'}
                                alt={user.username}
                                className="w-6 h-6 rounded-full"
                              />
                              <span className="text-sm">{user.username}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {taggedUsers.map((user) => (
                      <div key={user._id} className="flex items-center gap-1 bg-blue-100 rounded px-2 py-1">
                        <img
                          src={user.profilePicture || '/default-avatar.png'}
                          alt={user.username}
                          className="w-4 h-4 rounded-full"
                        />
                        <span className="text-sm">{user.username}</span>
                        <button
                          onClick={() => removeTaggedUser(user._id)}
                          className="text-gray-500 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateStatusImage}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Generate Preview
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Preview & Publish</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Your status is ready!</p>
                  {taggedUsers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">Tagged users:</p>
                      <div className="flex flex-wrap gap-1">
                        {taggedUsers.map((user) => (
                          <span key={user._id} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            @{user.username}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(2)}
                    disabled={isUploading}
                    className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={isUploading}
                    className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Uploading...
                      </>
                    ) : (
                      'Publish'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusCreationModal;
