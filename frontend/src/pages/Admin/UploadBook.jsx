import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { 
  Upload, 
  Image, 
  FileText, 
  X, 
  Plus,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

import { createBook, getCategories } from '../../store/slices/bookSlice';

const UploadBook = () => {
  const dispatch = useDispatch();
  const { categories, loading } = useSelector((state) => state.books);

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    category: '',
    summary: '',
    thumbnail: null,
    pdf: null
  });

  const [preview, setPreview] = useState({
    thumbnail: null,
    pdf: null
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maxSizeMB, setMaxSizeMB] = useState(50);

  useEffect(() => {
    dispatch(getCategories());
  }, [dispatch]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    const file = files[0];
    
    if (file) {
      // Per-file validations
      if (name === 'pdf') {
        if (file.type !== 'application/pdf') {
          setErrors(prev => ({ ...prev, pdf: 'Please select a PDF file' }));
          return;
        }
        const limitMB = Number(maxSizeMB) || 50;
        if (file.size > limitMB * 1024 * 1024) {
          setErrors(prev => ({ ...prev, pdf: `File size must be less than ${limitMB}MB` }));
          return;
        }
      }
      if (name === 'thumbnail') {
        if (!file.type.startsWith('image/')) {
          setErrors(prev => ({ ...prev, thumbnail: 'Please select an image file' }));
          return;
        }
        // Optional: 5MB limit for images
        const imageLimitMB = 5;
        if (file.size > imageLimitMB * 1024 * 1024) {
          setErrors(prev => ({ ...prev, thumbnail: `Image must be less than ${imageLimitMB}MB` }));
          return;
        }
      }
      setFormData(prev => ({
        ...prev,
        [name]: file
      }));

      // Create preview
      if (name === 'thumbnail' && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreview(prev => ({
            ...prev,
            thumbnail: e.target.result
          }));
        };
        reader.readAsDataURL(file);
      } else if (name === 'pdf' && file.type === 'application/pdf') {
        setPreview(prev => ({
          ...prev,
          pdf: file.name
        }));
      }
      // Clear specific error on valid selection
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const removeFile = (type) => {
    setFormData(prev => ({
      ...prev,
      [type]: null
    }));
    setPreview(prev => ({
      ...prev,
      [type]: null
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.author.trim()) {
      newErrors.author = 'Author is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.summary.trim()) {
      newErrors.summary = 'Summary is required';
    } else if (formData.summary.trim().length < 50) {
      newErrors.summary = 'Summary must be at least 50 characters';
    }

    if (!formData.thumbnail) {
      newErrors.thumbnail = 'Thumbnail is required';
    }

    if (!formData.pdf) {
      newErrors.pdf = 'PDF file is required';
    } else {
      const limitMB = Number(maxSizeMB) || 50;
      if (formData.pdf.size > limitMB * 1024 * 1024) {
        newErrors.pdf = `File size must be less than ${limitMB}MB`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors below');
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('author', formData.author);
      submitData.append('category', formData.category);
      submitData.append('summary', formData.summary);
      submitData.append('thumbnail', formData.thumbnail);
      submitData.append('pdf', formData.pdf);

      await dispatch(createBook(submitData)).unwrap();
      
      toast.success('Book uploaded successfully!');
      
      // Reset form
      setFormData({
        title: '',
        author: '',
        category: '',
        summary: '',
        thumbnail: null,
        pdf: null
      });
      setPreview({
        thumbnail: null,
        pdf: null
      });
      setErrors({});
      
    } catch (error) {
      toast.error('Failed to upload book');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload New Book</h1>
          <p className="text-gray-600">
            Add a new book to the BookHub library
          </p>
        </motion.div>

        {/* Upload Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Book Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter book title"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle size={16} className="mr-1" />
                    {errors.title}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Author *
                </label>
                <input
                  type="text"
                  name="author"
                  value={formData.author}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.author ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter author name"
                />
                {errors.author && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle size={16} className="mr-1" />
                    {errors.author}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.category ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.category}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Summary *
              </label>
              <textarea
                name="summary"
                value={formData.summary}
                onChange={handleInputChange}
                rows="4"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none ${
                  errors.summary ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter book summary (minimum 50 characters)"
              />
              <div className="flex justify-between items-center mt-1">
                {errors.summary ? (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle size={16} className="mr-1" />
                    {errors.summary}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    {formData.summary.length}/50 characters minimum
                  </p>
                )}
                <p className="text-sm text-gray-500">
                  {formData.summary.length} characters
                </p>
              </div>
            </div>

            {/* File Uploads */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Thumbnail Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Book Thumbnail *
                </label>
                <div className="space-y-4">
                  {preview.thumbnail ? (
                    <div className="relative">
                      <img
                        src={preview.thumbnail}
                        alt="Thumbnail preview"
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile('thumbnail')}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <Image className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600 mb-2">
                        Upload book thumbnail
                      </p>
                      <input
                        type="file"
                        name="thumbnail"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        id="thumbnail-upload"
                      />
                      <label
                        htmlFor="thumbnail-upload"
                        className="btn-outline cursor-pointer"
                      >
                        Choose Image
                      </label>
                    </div>
                  )}
                  {errors.thumbnail && (
                    <p className="text-sm text-red-600 flex items-center">
                      <AlertCircle size={16} className="mr-1" />
                      {errors.thumbnail}
                    </p>
                  )}
                </div>
              </div>

              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PDF File *
                </label>
                <div className="flex items-center gap-3 mb-3">
                  <label className="text-sm text-gray-600">Max size (MB)</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    step="1"
                    value={maxSizeMB}
                    onChange={(e) => setMaxSizeMB(e.target.value)}
                    className="w-24 px-3 py-1 border rounded-lg"
                  />
                  <span className="text-xs text-gray-500">Limit applies to selected PDF</span>
                </div>
                <div className="space-y-4">
                  {preview.pdf ? (
                    <div className="border border-gray-300 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-8 w-8 text-red-500" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {preview.pdf}
                            </p>
                            <p className="text-xs text-gray-500">PDF Document</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile('pdf')}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600 mb-2">
                        Upload PDF file
                      </p>
                      <input
                        type="file"
                        name="pdf"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="pdf-upload"
                      />
                      <label
                        htmlFor="pdf-upload"
                        className="btn-outline cursor-pointer"
                      >
                        Choose PDF
                      </label>
                    </div>
                  )}
                  {errors.pdf && (
                    <p className="text-sm text-red-600 flex items-center">
                      <AlertCircle size={16} className="mr-1" />
                      {errors.pdf}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    <span>Upload Book</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Upload Guidelines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6 mt-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Upload Guidelines
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Thumbnail Requirements:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Image format: JPG, PNG, or WebP</li>
                <li>• Recommended size: 300x400 pixels</li>
                <li>• Maximum file size: 5MB</li>
                <li>• High quality, clear book cover</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">PDF Requirements:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• File format: PDF only</li>
                <li>• Maximum file size: 50MB</li>
                <li>• Text-based PDF (not scanned images)</li>
                <li>• Complete book content</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UploadBook;
