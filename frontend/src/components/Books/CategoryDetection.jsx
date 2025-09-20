import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, X } from 'lucide-react';
import categoryService from '../../services/categoryService';
import toast from 'react-hot-toast';

const CategoryDetection = ({ title, description, onCategorySelect, onClose }) => {
  const [detectedCategory, setDetectedCategory] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [suggestedCategories, setSuggestedCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (title && title.trim()) {
      detectCategory();
    }
  }, [title, description]);

  const detectCategory = async () => {
    setLoading(true);
    try {
      const result = await categoryService.detectCategory(title, description || '');
      setDetectedCategory(result.category);
      setConfidence(result.confidence);
      setSuggestedCategories(result.suggestedCategories || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Category detection error:', error);
      toast.error('Failed to detect category');
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category) => {
    onCategorySelect(category);
    onClose();
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 0.8) return 'text-green-600';
    if (conf >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceText = (conf) => {
    if (conf >= 0.8) return 'High confidence';
    if (conf >= 0.6) return 'Medium confidence';
    return 'Low confidence';
  };

  if (!showSuggestions) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold">Category Detection</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
              <p className="text-gray-600">Analyzing book title...</p>
            </div>
          ) : (
            <>
              {/* Detected Category */}
              <div className="text-center">
                <h4 className="font-medium text-gray-900 mb-2">Detected Category</h4>
                <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                  <div className="text-lg font-semibold text-primary-700 mb-1">
                    {detectedCategory}
                  </div>
                  <div className={`text-sm ${getConfidenceColor(confidence)}`}>
                    {getConfidenceText(confidence)} ({Math.round(confidence * 100)}%)
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleCategorySelect(detectedCategory)}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Use This Category
                </button>
                <button
                  onClick={() => setShowSuggestions(true)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  See More
                </button>
              </div>

              {/* Suggested Categories */}
              {suggestedCategories.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Other Suggestions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {suggestedCategories.slice(0, 6).map((category) => (
                      <button
                        key={category}
                        onClick={() => handleCategorySelect(category)}
                        className="p-2 text-sm border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Entry */}
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-2">
                  Don't see the right category? You can manually select one when uploading.
                </p>
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  I'll choose manually
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CategoryDetection;
