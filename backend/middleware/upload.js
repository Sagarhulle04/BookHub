const multer = require('multer');
const path = require('path');

// Configure storage for different file types
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for images and PDFs
const fileFilter = (req, file, cb) => {
  // Allow images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  }
  // Allow PDFs
  else if (file.mimetype === 'application/pdf') {
    cb(null, true);
  }
  // Reject other file types
  else {
    cb(new Error('Only image and PDF files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// Specific upload configurations
const uploadImage = upload.single('image');
const uploadPDF = upload.single('pdf');
const uploadBook = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'pdf', maxCount: 1 }
]);

// Simple PDF-only upload for user uploads
const uploadBookSimple = upload.single('pdf');

module.exports = {
  upload,
  uploadImage,
  uploadPDF,
  uploadBook,
  uploadBookSimple
};

