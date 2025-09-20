import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, X, FileText, Image, BookOpen, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { createBook, getCategories, getBooks } from '../../store/slices/bookSlice';
import bookService from '../../services/bookService';

const UploadBook = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { categories, loading, isSuccess, message } = useSelector((state) => state.books);
  
  // Debug logging
  useEffect(() => {
    console.log('Current books state:', { loading, isSuccess, message });
  }, [loading, isSuccess, message]);
  const { user } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    summary: '',
    category: ''
  });

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const [files, setFiles] = useState({
    pdf: null
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedCategory, setDetectedCategory] = useState(null);
  const [categoryConfidence, setCategoryConfidence] = useState(null);
  const [analysisMethod, setAnalysisMethod] = useState(null);

  useEffect(() => {
    dispatch(getCategories());
  }, [dispatch]);

  useEffect(() => {
    if (isSuccess && message) {
      toast.success(message);
      // Reset form after successful upload
      setFormData({
        title: '',
        author: '',
        summary: ''
      });
      setFiles({ pdf: null });
      setErrors({});
    }
  }, [isSuccess, message]);

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
    const { name, files: fileList } = e.target;
    const file = fileList[0];
    
    console.log('File selected:', { name, file: file ? { name: file.name, size: file.size, type: file.type } : null });
    
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        console.log('Invalid file type:', file.type);
        setErrors(prev => ({
          ...prev,
          [name]: 'Please select a PDF file'
        }));
        return;
      }

      setFiles(prev => ({
        ...prev,
        [name]: file
      }));

      console.log('File set successfully:', file.name);

      // Clear error
      if (errors[name]) {
        setErrors(prev => ({
          ...prev,
          [name]: ''
        }));
      }

      // Show permission modal for PDF files
      if (name === 'pdf') {
        setShowPermissionModal(true);
        // Clear previous analysis results
        setDetectedCategory(null);
        setCategoryConfidence(null);
        setAnalysisMethod(null);
        setExtractedInfo(null);
        setPermissionGranted(false);
      }
    }
  };

  const removeFile = (fileType) => {
    setFiles(prev => ({
      ...prev,
      [fileType]: null
    }));
    // Clear analysis when file is removed
    if (fileType === 'pdf') {
      setDetectedCategory(null);
      setCategoryConfidence(null);
      setAnalysisMethod(null);
    }
  };

  const analyzeBook = async () => {
    if (!formData.title.trim() || !formData.summary.trim()) {
      toast.error('Please fill in title and summary before analyzing');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await bookService.detectCategory(formData.title, formData.summary);
      setDetectedCategory(result.category);
      setCategoryConfidence(result.confidence);
      setAnalysisMethod(result.analysisMethod);
      // Always update the category dropdown with detected category
      setFormData(prev => ({ ...prev, category: result.category }));
      toast.success(`Category detected: ${result.category} (${Math.round(result.confidence * 100)}% confidence)`);
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze book content');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const extractFromPDF = async () => {
    if (!files.pdf) {
      toast.error('Please select a PDF file first');
      return;
    }

    setIsExtracting(true);
    try {
      // Check authentication
      const token = localStorage.getItem('token');
      console.log('Token exists:', !!token);
      console.log('Token preview:', token ? token.substring(0, 20) + '...' : 'No token');
      
      // First upload the file to get a temporary path
      const formData = new FormData();
      formData.append('pdf', files.pdf);
      
      console.log('Uploading file:', files.pdf.name, 'Size:', files.pdf.size);
      
      // Upload file temporarily to get path
      const uploadResponse = await fetch('/api/books/temp-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('Upload response status:', uploadResponse.status);
      console.log('Upload response ok:', uploadResponse.ok);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload error response:', errorText);
        throw new Error(`Failed to upload file for analysis: ${uploadResponse.status} ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('Upload result:', uploadResult);
      
      // Extract information from PDF
      console.log('Extracting info for PDF:', uploadResult.fileName);
      const extractResponse = await fetch('/api/books/extract-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pdfPath: uploadResult.fileName })
      });

      console.log('Extract response status:', extractResponse.status);
      console.log('Extract response ok:', extractResponse.ok);

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        console.error('Extract error response:', errorText);
        throw new Error(`Failed to extract information from PDF: ${extractResponse.status} ${errorText}`);
      }

      const result = await extractResponse.json();
      setExtractedInfo(result.extractedInfo);
      
      // Auto-fill form with extracted information
      setFormData({
        title: result.extractedInfo.title || '',
        author: result.extractedInfo.author || '',
        summary: result.extractedInfo.summary || '',
        category: result.extractedInfo.category || ''
      });

      // Set category detection
      setDetectedCategory(result.extractedInfo.category);
      setCategoryConfidence(result.extractedInfo.categoryConfidence);
      setAnalysisMethod(result.extractedInfo.analysisMethod);

      // Close permission modal and mark permission as granted
      setShowPermissionModal(false);
      setPermissionGranted(true);

      toast.success('Book information extracted successfully!');
    } catch (error) {
      console.error('PDF extraction error:', error);
      toast.error('Failed to extract information from PDF');
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePermissionGrant = () => {
    setPermissionGranted(true);
    setShowPermissionModal(false);
    extractFromPDF();
  };

  const handlePermissionDeny = () => {
    setShowPermissionModal(false);
    setPermissionGranted(false);
    // Remove the PDF file if user denies permission
    setFiles(prev => ({ ...prev, pdf: null }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) newErrors.title = 'Book name is required';
    if (!files.pdf) newErrors.pdf = 'PDF file is required';
    if (!formData.author.trim()) newErrors.author = 'Author name is required';
    if (!formData.summary.trim()) newErrors.summary = 'Summary is required';

    // Additional validation
    if (formData.title.trim().length < 2) {
      newErrors.title = 'Book name must be at least 2 characters long';
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
      
      // Add form data
      Object.keys(formData).forEach(key => {
        if (formData[key]) {
          submitData.append(key, formData[key]);
        }
      });

      // Add analysis data if available
      if (detectedCategory) {
        submitData.append('detectedCategory', detectedCategory);
        submitData.append('categoryConfidence', categoryConfidence);
        submitData.append('analysisMethod', analysisMethod);
        // Use detected category as the final category
        submitData.append('category', detectedCategory);
      }

      // Add files
      submitData.append('pdf', files.pdf);

      console.log('Submitting form data:', {
        title: formData.title,
        author: formData.author,
        summary: formData.summary,
        pdfFile: files.pdf?.name,
        pdfSize: files.pdf?.size
      });

      console.log('Dispatching createBook action...');
      const result = await dispatch(createBook(submitData)).unwrap();
      console.log('Upload result:', result);
      
      // Refresh the books list to show the newly uploaded book
      dispatch(getBooks({ page: 1, limit: 12 }));
      
      // Navigate to home page after successful upload
      setTimeout(() => {
        navigate('/');
      }, 2000);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error || 'Failed to upload book');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload a Book</h1>
          <p className="text-gray-600">
            Share your favorite book with the BookHub community. Your upload will be reviewed before being published.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* PDF Upload - First Step */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDF File *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                {files.pdf ? (
                  <div className="space-y-3">
                    <FileText className="mx-auto h-16 w-16 text-green-500" />
                    <p className="text-lg text-gray-600 font-medium">{files.pdf.name}</p>
                    <p className="text-sm text-gray-500">
                      {(files.pdf.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={() => removeFile('pdf')}
                        className="text-red-600 hover:text-red-800 text-sm flex items-center"
                      >
                        <X size={16} className="mr-1" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <BookOpen className="mx-auto h-16 w-16 text-gray-400" />
                    <p className="mt-4 text-lg text-gray-600 font-medium">
                      Upload your book PDF
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Drag and drop your PDF here, or click to browse
                    </p>
                  </div>
                )}
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
                  className="mt-4 btn-primary cursor-pointer inline-block"
                >
                  {files.pdf ? 'Change File' : 'Choose PDF File'}
                </label>
              </div>
              {errors.pdf && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.pdf}
                </p>
              )}
              
              {/* Extracted Information Display */}
              {extractedInfo && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-medium text-green-900 mb-2">Extracted Information:</h4>
                  <div className="space-y-1 text-sm text-green-800">
                    <p><strong>Title:</strong> {extractedInfo.title}</p>
                    <p><strong>Author:</strong> {extractedInfo.author}</p>
                    <p><strong>Category:</strong> {extractedInfo.category} ({Math.round(extractedInfo.categoryConfidence * 100)}% confidence)</p>
                    <p><strong>Pages:</strong> {extractedInfo.pages}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Book Information - Only show after PDF upload */}
            {files.pdf && (
              <>
                {/* Book Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Book Name *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`input-field ${errors.title ? 'border-red-500' : ''}`}
                placeholder="Enter book name"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.title}
                </p>
              )}
            </div>

            {/* Author Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Author Name *
              </label>
              <input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                className={`input-field ${errors.author ? 'border-red-500' : ''}`}
                placeholder="Enter author name"
              />
              {errors.author && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.author}
                </p>
              )}
            </div>

            {/* Summary */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Summary *
                </label>
                <button
                  type="button"
                  onClick={analyzeBook}
                  disabled={isAnalyzing || !formData.title.trim() || !formData.summary.trim()}
                  className="text-sm text-primary-600 hover:text-primary-800 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <BookOpen size={16} />
                      Analyze Category
                    </>
                  )}
                </button>
              </div>
              <textarea
                name="summary"
                value={formData.summary}
                onChange={handleInputChange}
                className={`input-field ${errors.summary ? 'border-red-500' : ''}`}
                rows="4"
                placeholder="Write a short summary of the book"
              />
              {errors.summary && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.summary}
                </p>
              )}
            </div>

            {/* Category Analysis Results - Display Only */}
            {detectedCategory && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      Detected Category: {detectedCategory}
                    </p>
                    <p className="text-xs text-green-700">
                      Confidence: {Math.round(categoryConfidence * 100)}% • 
                      Method: {analysisMethod === 'title_description' ? 'Title & Summary' : 
                              analysisMethod === 'pdf_analysis' ? 'PDF Content' : 
                              analysisMethod === 'advanced_pattern' ? 'Advanced Pattern' : 
                              analysisMethod === 'user_selected' ? 'User Selected' : 'Unknown'}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Category will be automatically assigned based on PDF content analysis.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDetectedCategory(null);
                      setCategoryConfidence(null);
                      setAnalysisMethod(null);
                    }}
                    className="text-green-600 hover:text-green-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}


                {/* Submit Button */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      <p>Your book will be reviewed before being published.</p>
                      <p>You'll be notified once it's approved.</p>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || loading}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => console.log('Button clicked, state:', { isSubmitting, loading, formData, files })}
                    >
                      {isSubmitting ? 'Uploading...' : 'Upload Book'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </form>
        </motion.div>
      </div>

      {/* Permission Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <BookOpen className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">
                Extract Book Information?
              </h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-3">
                We can automatically extract the following information from your PDF:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Book title</li>
                <li>• Author name</li>
                <li>• Book summary</li>
                <li>• Category classification</li>
              </ul>
              <p className="text-sm text-gray-500 mt-3">
                This will help you fill out the form faster. You can always edit the extracted information.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePermissionDeny}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                No, I'll fill manually
              </button>
              <button
                onClick={handlePermissionGrant}
                disabled={isExtracting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isExtracting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Extracting...
                  </>
                ) : (
                  'Yes, extract information'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadBook;
