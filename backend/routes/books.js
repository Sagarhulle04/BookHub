const express = require("express");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const Book = require("../models/Book");
const { auth, optionalAuth } = require("../middleware/auth");
const admin = require("../middleware/admin");
const { uploadBook, uploadBookSimple } = require("../middleware/upload");
const axios = require("axios");
const cloudinary = require("../utils/cloudinary");
const { compressPdf } = require("../utils/pdfCompression");
const Highlight = require("../models/Highlight");
const categoryDetection = require("../services/categoryDetection");
const pdfAnalysis = require("../services/pdfAnalysis");

// No-op stub to satisfy legacy routes referencing b2Upload
const b2Upload = { single: () => (req, res, next) => next() };

const router = express.Router();
// Advanced personalized feed with ML recommendations and infinite scroll
// GET /api/books/feed
router.get("/feed", optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const user = req.user;
    const now = Date.now();
    const myId = user?._id?.toString();

    // Get user preferences for ML recommendations
    let userPreferences = {
      likedCategories: [],
      likedAuthors: [],
      followingIds: new Set(),
      likedBookIds: new Set(),
    };

    if (user) {
      // Get user's liked books for ML recommendations
      const Like = require("../models/Like");
      const likedBooks = await Like.find({ user: user._id })
        .populate("book")
        .lean();
      userPreferences.likedBookIds = new Set(
        likedBooks.map((l) => l.book?._id?.toString()).filter(Boolean)
      );

      // Extract categories and authors from liked books
      const likedBookData = likedBooks.map((l) => l.book).filter(Boolean);
      userPreferences.likedCategories = [
        ...new Set(likedBookData.map((b) => b.category).filter(Boolean)),
      ];
      userPreferences.likedAuthors = [
        ...new Set(likedBookData.map((b) => b.author).filter(Boolean)),
      ];
      userPreferences.followingIds = new Set(
        (user.following || []).map((id) => id.toString())
      );
    }

    // Build comprehensive query for different types of books
    let books = [];

    // 1. Get all globally visible books (admin + user books)
    const allBooks = await Book.find({
      status: "published",
      isApproved: true,
      isGlobal: true, // All books are globally visible
    })
      .populate("uploadedBy", "username profilePicture followers")
      .sort({ createdAt: -1 }) // Latest first
      .lean();

    // Remove own books
    const filteredBooks = allBooks.filter((book) => {
      const uploaderId = (
        book.uploadedBy?._id ||
        book.uploadedBy ||
        ""
      ).toString();
      return uploaderId !== myId;
    });

    // Advanced scoring algorithm with latest-first priority
    const scored = filteredBooks.map((book) => {
      const uploaderId = (
        book.uploadedBy?._id ||
        book.uploadedBy ||
        ""
      ).toString();
      const bookId = book._id.toString();

      // Time-based scoring (latest books get highest score)
      const ageHours = Math.max(
        0,
        (now - new Date(book.createdAt).getTime()) / (1000 * 60 * 60)
      );
      const recencyScore = Math.max(0, 1000 - ageHours); // Higher score for newer books

      // Popularity score
      const popularityScore = (book.viewCount || 0) * 0.1;

      // Priority scores based on user relationship
      let priorityScore = 0;
      if (book.isAdminShared) {
        priorityScore = 500; // High priority for admin books
      } else if (userPreferences.followingIds.has(uploaderId)) {
        priorityScore = 300; // Very high priority for followed users
      } else if (book.uploadedBy?.followers?.length >= 10) {
        priorityScore = 200; // High priority for high-following users
      } else if (userPreferences.likedBookIds.has(bookId)) {
        priorityScore = 150; // Medium-high priority for liked books
      } else if (userPreferences.likedCategories.includes(book.category)) {
        priorityScore = 100; // Medium priority for ML category match
      } else if (userPreferences.likedAuthors.includes(book.author)) {
        priorityScore = 80; // Medium priority for ML author match
      } else {
        priorityScore = 50; // Default priority
      }

      // Engagement boost
      const engagementBoost =
        (book.likeCount || 0) * 5 + (book.commentCount || 0) * 2;

      // Final score (recency has the highest weight)
      const score =
        recencyScore + priorityScore + popularityScore + engagementBoost;

      return { score, book };
    });

    // Sort by score and apply pagination
    scored.sort((a, b) => b.score - a.score);
    let paginatedBooks = scored.slice(skip, skip + limit).map((s) => s.book);

    // Enrich with user-specific flags
    if (user) {
      const likedIdSet = userPreferences.likedBookIds || new Set();
      paginatedBooks = paginatedBooks.map((b) => ({
        ...b,
        liked: likedIdSet.has(b._id.toString()),
      }));
    }

    // For infinite scroll, we'll return more books than requested to ensure smooth scrolling
    const hasMore = scored.length > skip + limit;
    const totalBooks = scored.length;

    res.json({
      books: paginatedBooks,
      pagination: {
        currentPage: page,
        hasNext: hasMore,
        hasPrev: page > 1,
        limit,
        totalBooks,
      },
      feedInfo: {
        totalBooks: filteredBooks.length,
        adminBooks: filteredBooks.filter((b) => b.isAdminShared).length,
        followingBooks: user
          ? filteredBooks.filter((b) =>
              userPreferences.followingIds.has(
                (b.uploadedBy?._id || b.uploadedBy || "").toString()
              )
            ).length
          : 0,
        latestBooks: filteredBooks.filter((b) => {
          const ageHours =
            (now - new Date(b.createdAt).getTime()) / (1000 * 60 * 60);
          return ageHours <= 24; // Books uploaded in last 24 hours
        }).length,
        totalScored: scored.length,
      },
    });
  } catch (e) {
    console.error("Advanced feed error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Simple in-book Q&A stub using summary/metadata (heuristic v1)
// POST /api/books/:id/qa { question }
router.post("/:id/qa", optionalAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }
    const book = await Book.findById(req.params.id).lean();
    if (!book) return res.status(404).json({ message: "Book not found" });
    const { question } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({ message: "Question is required" });
    }
    const { answerQuestion } = require("../utils/pdfQa");
    const path = require("path");
    const localPath = book.localPdfPath
      ? path.join(__dirname, "../uploads/pdfs", book.localPdfPath)
      : null;
    const remoteUrl = book.pdfUrl || null;
    const cacheKey = book._id.toString();
    const result = await answerQuestion({
      question,
      localPath,
      remoteUrl,
      cacheKey,
    });
    res.json(result);
  } catch (e) {
    console.error("QA error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/books
// @desc    Get all books with pagination and filters
// @access  Public
router.get("/", optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const category = req.query.category;
    const search = req.query.search;
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // Build query - include all globally visible books
    let query = {
      status: "published",
      isApproved: true,
      isGlobal: true, // All books are globally visible
    };

    if (category && category !== "all") {
      query.category = category;
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Exclude my own uploads from the public list if logged in
    if (req.user?._id) {
      query.uploadedBy = { $ne: req.user._id };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder;

    // Execute query
    let books = await Book.find(query)
      .populate("uploadedBy", "username profilePicture")
      .sort(sort)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    // Enrich with liked flag for authenticated users
    if (req.user && books.length > 0) {
      const Like = require("../models/Like");
      const bookIds = books.map((b) => b._id);
      const likes = await Like.find({
        user: req.user._id,
        book: { $in: bookIds },
      })
        .select("book")
        .lean();
      const likedSet = new Set(likes.map((l) => l.book.toString()));
      books = books.map((b) => ({
        ...b,
        liked: likedSet.has(b._id.toString()),
      }));
    }

    // Get total count
    const total = await Book.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.json({
      books,
      pagination: {
        currentPage: page,
        totalPages,
        totalBooks: total,
        hasNext,
        hasPrev,
        limit,
      },
    });
  } catch (error) {
    console.error("Get books error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/books/search
// @desc    Search books with advanced filters (supports name/title and author)
// @access  Public
router.get("/search", optionalAuth, async (req, res) => {
  try {
    const { q, category, author, year, language, sortBy, sortOrder } =
      req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    // Build search query - include all globally visible books
    let query = {
      status: "published",
      isApproved: true,
      isGlobal: true, // All books are globally visible
    };

    if (category && category !== "all") {
      query.category = category;
    }

    if (author) {
      query.author = { $regex: author, $options: "i" };
    }

    if (year) {
      query.publishedYear = parseInt(year);
    }

    if (language) {
      query.language = { $regex: language, $options: "i" };
    }

    // Exclude my own uploads from search results if logged in
    if (req.user?._id) {
      query.uploadedBy = { $ne: req.user._id };
    }

    let books = [];
    let total = 0;
    if (q) {
      // Use text index ranking when a query is present
      const textQuery = { ...query, $text: { $search: q } };
      books = await Book.find(textQuery, { score: { $meta: "textScore" } })
        .populate("uploadedBy", "username profilePicture")
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();
      total = await Book.countDocuments(textQuery);
    } else {
      // No q: fall back to regular listing
      const sort = {};
      sort[sortBy || "createdAt"] = sortOrder === "asc" ? 1 : -1;
      books = await Book.find(query)
        .populate("uploadedBy", "username profilePicture")
        .sort(sort)
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();
      total = await Book.countDocuments(query);
    }

    // Enrich with liked flag for authenticated users
    if (req.user && books.length > 0) {
      const Like = require("../models/Like");
      const bookIds = books.map((b) => b._id);
      const likes = await Like.find({
        user: req.user._id,
        book: { $in: bookIds },
      })
        .select("book")
        .lean();
      const likedSet = new Set(likes.map((l) => l.book.toString()));
      books = books.map((b) => ({
        ...b,
        liked: likedSet.has(b._id.toString()),
      }));
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      books,
      pagination: {
        currentPage: page,
        totalPages,
        totalBooks: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit,
      },
    });
  } catch (error) {
    console.error("Search books error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/books/suggest
// @desc    Lightweight suggestions for books by title or author (regex, limited)
// @access  Public
router.get("/suggest", optionalAuth, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    if (!q) return res.json({ books: [] });

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const base = {
      status: "published",
      isApproved: true,
      isGlobal: true, // All books are globally visible
    };
    // Exclude own uploads
    if (req.user?._id) {
      base.uploadedBy = { $ne: req.user._id };
    }

    const books = await Book.find({
      ...base,
      $or: [{ title: { $regex: regex } }, { author: { $regex: regex } }],
    })
      .select("_id title author thumbnail")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ books });
  } catch (e) {
    console.error("Suggest books error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/books/categories
// @desc    Get all book categories
// @access  Public
router.get("/categories", (req, res) => {
  const categories = [
    "Fiction",
    "Non-Fiction",
    "Mystery",
    "Romance",
    "Science Fiction",
    "Fantasy",
    "Biography",
    "History",
    "Self-Help",
    "Business",
    "Technology",
    "Philosophy",
    "Religion",
    "Poetry",
    "Drama",
    "Children",
    "Young Adult",
    "Classic",
    "Contemporary",
    "Other",
  ];

  res.json(categories);
});

// Topic collections (heuristic v1 using existing categories and keyword groups)
router.get("/topics", async (req, res) => {
  try {
    // Group by category and top tokens in title/summary
    const books = await Book.find({ status: "published", isApproved: true })
      .select("title summary category")
      .lean();
    const topics = new Map();
    for (const b of books) {
      const baseKey = b.category || "Other";
      const key = baseKey;
      topics.set(key, (topics.get(key) || 0) + 1);
    }
    const ordered = Array.from(topics.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    res.json({ topics: ordered.slice(0, 20) });
  } catch (e) {
    console.error("Topics error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/books/my-uploads
// @desc    Get books uploaded by the current user
// @access  Private
router.get("/my-uploads", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const status = req.query.status; // 'draft', 'published', 'archived'

    // Build query
    let query = { uploadedBy: req.user._id };

    if (status) {
      query.status = status;
    }

    // Execute query
    const books = await Book.find(query)
      .populate("uploadedBy", "username profilePicture")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    // Get total count
    const total = await Book.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.json({
      books,
      pagination: {
        currentPage: page,
        totalPages,
        totalBooks: total,
        hasNext,
        hasPrev,
        limit,
      },
    });
  } catch (error) {
    console.error("Get my uploads error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/books/:id
// @desc    Get book by ID
// @access  Public
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    // Validate book ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }

    const book = await Book.findById(req.params.id).populate(
      "uploadedBy",
      "username profilePicture bio"
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (book.status !== "published" || !book.isApproved) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Increment view count if user is authenticated
    if (req.user) {
      await book.incrementViewCount();
    }

    // Attach liked flag if authenticated
    let responseBook = book.toObject();
    if (req.user) {
      const Like = require("../models/Like");
      const liked = await Like.exists({ user: req.user._id, book: book._id });
      responseBook.liked = !!liked;
    }

    res.json(responseBook);
  } catch (error) {
    console.error("Get book error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/books/:id/read
// @desc    Get book reading data (book info + PDF URL for reading)
// @access  Public
router.get("/:id/read", optionalAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }

    const book = await Book.findById(req.params.id).populate(
      "uploadedBy",
      "username profilePicture bio"
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (book.status !== "published" || !book.isApproved) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Increment view count if user is authenticated
    if (req.user) {
      await book.incrementViewCount();
    }

    // Determine liked flag
    let liked = false;
    if (req.user) {
      const Like = require("../models/Like");
      liked = !!(await Like.exists({ user: req.user._id, book: book._id }));
    }

    // Return book data with PDF URL for reading
    res.json({
      book: {
        _id: book._id,
        title: book.title,
        author: book.author,
        category: book.category,
        summary: book.summary,
        thumbnail: book.thumbnail,
        pdfUrl: book.pdfUrl,
        localPdfPath: book.localPdfPath,
        language: book.language,
        viewCount: book.viewCount,
        likeCount: book.likeCount,
        commentCount: book.commentCount,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        uploadedBy: book.uploadedBy,
        liked,
      },
      readingUrl: `/books/${book._id}/pdf`,
    });
  } catch (error) {
    console.error("Get book read data error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/books/:id/pdf
// @desc    Get PDF file for a book
// @access  Public
router.get("/:id/pdf", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });
    if (!book.pdfUrl)
      return res
        .status(404)
        .json({ message: "PDF not available for this book" });

    const fs = require("fs");
    const path = require("path");

    // 1) Prefer serving the locally-saved PDF to avoid cross-origin/CORS issues
    if (book.localPdfPath) {
      const uploadsDir = path.join(__dirname, "../uploads");
      const pdfsDir = path.join(uploadsDir, "pdfs");
      const specificPdfPath = path.join(pdfsDir, book.localPdfPath);
      if (fs.existsSync(specificPdfPath)) {
        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${book.title}.pdf"`,
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        return fs.createReadStream(specificPdfPath).pipe(res);
      }
    }

    // 2) Fallback: proxy from Cloudinary/pdfUrl
    try {
      const axios = require("axios");
      const response = await axios.get(book.pdfUrl, {
        responseType: "stream",
        timeout: 30000,
      });

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${book.title}.pdf"`,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return response.data.pipe(res);
    } catch (proxyError) {
      console.error(
        "PDF proxy error:",
        proxyError?.response?.status || proxyError.message
      );

      // 3) Last-resort: try any local fallback file to keep viewer functional
      const uploadsDir = path.join(__dirname, "../uploads");
      const pdfsDir = path.join(uploadsDir, "pdfs");
      let localPdfPath = null;
      if (fs.existsSync(pdfsDir)) {
        const files = fs.readdirSync(pdfsDir).filter((f) => f.endsWith(".pdf"));
        if (files.length > 0) localPdfPath = path.join(pdfsDir, files[0]);
      }
      if (!localPdfPath && fs.existsSync(uploadsDir)) {
        const files = fs
          .readdirSync(uploadsDir)
          .filter((f) => f.endsWith(".pdf"));
        if (files.length > 0) localPdfPath = path.join(uploadsDir, files[0]);
      }
      if (localPdfPath && fs.existsSync(localPdfPath)) {
        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${book.title}.pdf"`,
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        return fs.createReadStream(localPdfPath).pipe(res);
      }

      // Do NOT redirect (breaks in-app viewer). Return clear error.
      return res.status(403).json({
        message: "PDF access issue. The file may be private or unavailable.",
      });
    }
  } catch (error) {
    console.error("Get PDF error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// @route   PUT /api/books/:id/make-public
// @desc    Make a book's PDF publicly accessible
// @access  Private (Admin only)
router.put("/:id/make-public", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }

    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });
    if (!book.pdfUrl)
      return res
        .status(404)
        .json({ message: "PDF not available for this book" });

    // Extract public_id from Cloudinary URL
    const urlParts = book.pdfUrl.split("/");
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = publicIdWithExtension.split(".")[0];
    const folder = urlParts[urlParts.length - 2];

    try {
      // Make the file explicitly public
      await cloudinary.uploader.explicit(`${folder}/${publicId}`, {
        type: "upload",
        resource_type: "raw",
        access_mode: "public",
      });

      res.json({
        message: "Book PDF is now publicly accessible",
        publicId: `${folder}/${publicId}`,
      });
    } catch (cloudinaryError) {
      console.error("Cloudinary error:", cloudinaryError);
      res.status(500).json({
        message: "Failed to make PDF public",
        error: cloudinaryError.message,
      });
    }
  } catch (error) {
    console.error("Make public error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/books
// @desc    Create a new book (Authenticated users) - Cloudinary
// @access  Private
router.post(
  "/",
  [auth, uploadBookSimple],
  [
    // Title, author, and summary are now optional as they'll be auto-extracted from PDF
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        author,
        summary,
        detectedCategory: frontendCategory,
        categoryConfidence: frontendConfidence,
        analysisMethod: frontendMethod,
        category: userSelectedCategory,
      } = req.body;
      console.log("Creating book with title:", title);
      console.log("Request file:", req.file);
      console.log("Frontend analysis data:", {
        frontendCategory,
        frontendConfidence,
        frontendMethod,
      });

      if (!req.file) {
        return res.status(400).json({ message: "PDF file is required" });
      }

      // Save local PDF file first
      const uploadsDir = path.join(__dirname, "../uploads");
      const pdfsDir = path.join(uploadsDir, "pdfs");

      // Ensure pdfs directory exists
      if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
      }

      // Generate unique filename for local storage
      const timestamp = Date.now();
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, "_");
      const localFileName = `${sanitizedTitle}_${timestamp}.pdf`;
      const localPdfPath = path.join(pdfsDir, localFileName);

      // Defer local save until after successful upload for speed

      // Prepare Cloudinary upload. If large, try compressing locally first.
      const publicIdBase = `${title.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${Date.now()}`;

      const sizeBytes = req.file.size || 0;
      const sizeThresholdMb = parseInt(
        process.env.CLOUDINARY_PDF_MAX_MB || "15",
        10
      );
      const isLargePdf = sizeBytes > sizeThresholdMb * 1024 * 1024;

      let sourcePathForUpload = req.file.path;
      let compressedTempPath = null;

      if (isLargePdf && req.file.path) {
        try {
          const qualities = ["screen", "ebook"];
          for (const q of qualities) {
            const outPath = await compressPdf(req.file.path, q);
            if (outPath && fs.existsSync(outPath)) {
              const originalSize = fs.statSync(req.file.path).size;
              const compressedSize = fs.statSync(outPath).size;
              if (compressedSize < originalSize * 0.85) {
                sourcePathForUpload = outPath;
                compressedTempPath = outPath;
                break;
              } else {
                try {
                  fs.unlinkSync(outPath);
                } catch (_) {}
              }
            }
          }
        } catch (compressionError) {
          console.log(
            "PDF compression skipped/failure:",
            compressionError.message
          );
        }
      }

      const uploadOptions = {
        folder: "bookhub/pdfs",
        resource_type: "image",
        type: "upload",
        public_id: publicIdBase,
        access_mode: "public",
        invalidate: true,
        eager: undefined,
      };

      const uploadSource =
        sourcePathForUpload ||
        `data:${req.file.mimetype};base64,${req.file.buffer.toString(
          "base64"
        )}`;
      let uploadResult;
      if (isLargePdf && sourcePathForUpload) {
        uploadResult = await cloudinary.uploader.upload_large(uploadSource, {
          ...uploadOptions,
          chunk_size: 6 * 1024 * 1024,
        });
      } else {
        uploadResult = await cloudinary.uploader.upload(
          uploadSource,
          uploadOptions
        );
      }

      const pdfUrl = uploadResult.secure_url;

      // First page thumbnail URL (jpg of page 1)
      const thumbnailUrl = cloudinary.url(uploadResult.public_id, {
        resource_type: "image",
        format: "jpg",
        page: 1,
        secure: true,
      });

      // Save the used source file locally for in-app PDF serving
      try {
        if (sourcePathForUpload && fs.existsSync(sourcePathForUpload)) {
          fs.copyFileSync(sourcePathForUpload, localPdfPath);
        } else if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.copyFileSync(req.file.path, localPdfPath);
        } else if (req.file?.buffer) {
          fs.writeFileSync(localPdfPath, req.file.buffer);
        }
      } catch (_) {}

      // Extract book information from PDF if not provided
      let extractedInfo = {};
      try {
        console.log("Extracting book information from PDF...");
        extractedInfo = await pdfAnalysis.extractBookMetadata(localPdfPath);
        console.log("Extracted info:", extractedInfo);
      } catch (error) {
        console.error("PDF analysis failed:", error);
      }

      // Use extracted information if not provided in form
      const finalTitle = title || extractedInfo.title || "Unknown Title";
      const finalAuthor = author || extractedInfo.author || "Unknown Author";
      const finalSummary =
        summary || extractedInfo.summary || "No summary available";

      // Use user-selected category if provided, else frontend analysis if available, otherwise auto-detect category
      let detectedCategory = "Other";
      let categoryConfidence = 0.5;
      let analysisMethod = "title_description";

      if (userSelectedCategory) {
        // Frontend may send category as an array (e.g., ['Philosophy', ...])
        // Ensure we store a single string value that matches the schema
        if (Array.isArray(userSelectedCategory)) {
          detectedCategory = (userSelectedCategory[0] || "Other").toString();
        } else {
          detectedCategory = userSelectedCategory.toString();
        }
        categoryConfidence = 1.0;
        // Map user selection to a valid enum value for analysisMethod
        analysisMethod = "manual";
        console.log("Using user-selected category:", detectedCategory);
      } else if (frontendCategory && frontendConfidence && frontendMethod) {
        // Use frontend analysis results
        detectedCategory = frontendCategory;
        categoryConfidence = parseFloat(frontendConfidence);
        // Sanitize frontendMethod to one of the allowed schema enums; default to 'title_description'
        const allowedMethods = [
          "title_description",
          "pdf_analysis",
          "advanced_pattern",
          "manual",
          "error",
        ];
        analysisMethod = allowedMethods.includes(frontendMethod)
          ? frontendMethod
          : "title_description";
        console.log("Using frontend analysis:", {
          category: detectedCategory,
          confidence: categoryConfidence,
          method: analysisMethod,
        });
      } else {
        // Auto-detect category using extracted information
        try {
          const categoryResult = await categoryDetection.detectCategory(
            finalTitle,
            finalSummary,
            localPdfPath
          );
          detectedCategory = categoryResult.category;
          categoryConfidence = categoryResult.confidence;
          analysisMethod = categoryResult.analysisMethod || "pdf_analysis";
          console.log("Backend category detection result:", {
            category: detectedCategory,
            confidence: categoryConfidence,
            method: analysisMethod,
          });
        } catch (error) {
          console.error("Category detection failed:", error);
        }
      }

      const bookData = {
        title: finalTitle,
        author: finalAuthor,
        category: detectedCategory,
        categoryConfidence, // Store confidence score
        analysisMethod, // Store how the category was detected
        summary: finalSummary,
        thumbnail: thumbnailUrl,
        pdfUrl,
        localPdfPath: localFileName, // Store just the filename, not full path
        language: "English",
        uploadedBy: req.user._id,
        isApproved: true,
        status: "published",
        isAdminShared: req.user.role === "admin", // Mark as admin-shared if uploaded by admin
        isGlobal: true, // All books are globally visible by default
      };

      const book = new Book(bookData);
      await book.save();

      // Broadcast notification via SSE
      try {
        const sseClients = req.app.get("sseClients");
        const payload = JSON.stringify({
          type: "book_uploaded",
          message: `New book uploaded: ${book.title}`,
          createdAt: Date.now(),
          bookId: book._id,
        });
        for (const client of sseClients) {
          client.write(`event: notification\ndata: ${payload}\n\n`);
        }
      } catch (_) {}

      // Cleanup temp compressed file if used
      if (compressedTempPath) {
        try {
          fs.unlinkSync(compressedTempPath);
        } catch (_) {}
      }

      res
        .status(201)
        .json({ message: "Book uploaded and published successfully!", book });
    } catch (error) {
      console.error("Create book error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   PUT /api/books/:id
// @desc    Update book (Admin only)
// @access  Private/Admin
router.put("/:id", [auth, admin], async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    const updates = req.body;
    Object.keys(updates).forEach((key) => {
      if (key !== "uploadedBy" && key !== "_id") {
        book[key] = updates[key];
      }
    });

    await book.save();

    res.json({
      message: "Book updated successfully",
      book,
    });
  } catch (error) {
    console.error("Update book error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   DELETE /api/books/:id
// @desc    Delete book (Admin only)
// @access  Private/Admin
router.delete("/:id", auth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Allow delete if admin or owner
    const isOwner =
      book.uploadedBy && book.uploadedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this book" });
    }

    // Remove local PDF if present
    if (book.localPdfPath) {
      try {
        const fs = require("fs");
        const path = require("path");
        const localPath = path.join(
          __dirname,
          "../uploads/pdfs",
          book.localPdfPath
        );
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch (e) {
        console.log("Could not remove local PDF:", e.message);
      }
    }

    await Book.findByIdAndDelete(req.params.id);

    res.json({ message: "Book deleted successfully" });
  } catch (error) {
    console.error("Delete book error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/books/s3
// @desc    Create a new book with S3 upload (Authenticated users)
// @access  Private
router.post(
  "/s3",
  [auth, b2Upload.single("pdf")],
  [body("title").notEmpty().withMessage("Title is required")],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, category: userSelectedCategory } = req.body;

      console.log("Creating book with S3 upload, title:", title);
      console.log("S3 file:", req.file);

      // Get PDF URL from S3 upload
      let pdfUrl = "";
      if (req.file) {
        pdfUrl = req.file.location; // S3 file URL
        console.log("File uploaded to S3:", pdfUrl);
      } else {
        console.log("No file provided in request");
      }

      // Create book with default values
      // Prefer user-selected category; otherwise auto-detect
      let detectedCategory = "Other";
      let categoryConfidence = 0.5;
      let analysisMethod = "title_description";

      if (userSelectedCategory) {
        // Frontend may send category as an array (e.g., ['Philosophy', ...])
        if (Array.isArray(userSelectedCategory)) {
          detectedCategory = (userSelectedCategory[0] || "Other").toString();
        } else {
          detectedCategory = userSelectedCategory.toString();
        }
        categoryConfidence = 1.0;
        analysisMethod = "manual";
      } else {
        try {
          const categoryResult = await categoryDetection.detectCategory(
            title,
            "No summary provided."
          );
          detectedCategory = categoryResult.category;
          categoryConfidence = categoryResult.confidence;
        } catch (error) {
          console.error("Category detection failed:", error);
        }
      }

      const bookData = {
        title,
        author: "Unknown Author", // Default value
        category: detectedCategory,
        categoryConfidence, // Store confidence score
        analysisMethod,
        summary: "No summary provided.", // Default value
        thumbnail: "", // No thumbnail for user uploads
        pdfUrl,
        language: "English", // Default value
        uploadedBy: req.user._id,
        isApproved: true, // Auto-approve all user uploads for now
        status: "published", // Auto-publish all user uploads
        isAdminShared: req.user.role === "admin", // Mark as admin-shared if uploaded by admin
        isGlobal: true, // All books are globally visible by default
      };

      console.log("Creating book with data:", bookData);

      const book = new Book(bookData);
      await book.save();

      console.log("Book saved successfully:", book._id);

      const message = "Book uploaded and published successfully!";
      res.status(201).json({
        message,
        book,
      });
    } catch (error) {
      console.error("Create book error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   POST /api/books/:id/share-globally
// @desc    Share a book globally (Admin only) - makes any book visible to all users
// @access  Private/Admin
router.post("/:id/share-globally", [auth, admin], async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Mark book as admin-shared
    book.isAdminShared = true;
    book.isApproved = true;
    book.status = "published";
    await book.save();

    // Broadcast notification via SSE
    try {
      const sseClients = req.app.get("sseClients");
      const payload = JSON.stringify({
        type: "book_shared_globally",
        message: `Admin shared book globally: ${book.title}`,
        createdAt: Date.now(),
        bookId: book._id,
      });
      for (const client of sseClients) {
        client.write(`event: notification\ndata: ${payload}\n\n`);
      }
    } catch (_) {}

    res.json({
      message: "Book shared globally successfully!",
      book,
    });
  } catch (error) {
    console.error("Share book globally error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   DELETE /api/books/:id/share-globally
// @desc    Unshare a book globally (Admin only) - removes book from global visibility
// @access  Private/Admin
router.delete("/:id/share-globally", [auth, admin], async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Remove admin-shared status
    book.isAdminShared = false;
    await book.save();

    // Broadcast notification via SSE
    try {
      const sseClients = req.app.get("sseClients");
      const payload = JSON.stringify({
        type: "book_unshared_globally",
        message: `Admin unshared book globally: ${book.title}`,
        createdAt: Date.now(),
        bookId: book._id,
      });
      for (const client of sseClients) {
        client.write(`event: notification\ndata: ${payload}\n\n`);
      }
    } catch (_) {}

    res.json({
      message: "Book unshared globally successfully!",
      book,
    });
  } catch (error) {
    console.error("Unshare book globally error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/books/detect-category
// @desc    Detect book category using ML based on title and description
// @access  Private
router.post("/detect-category", auth, async (req, res) => {
  try {
    const { title, description = "" } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Book title is required" });
    }

    const result = await categoryDetection.detectCategory(title, description);

    res.json({
      category: result.category,
      confidence: result.confidence,
      allScores: result.allScores,
      analysisMethod: result.analysisMethod,
      suggestedCategories: categoryDetection.getCategoryRecommendations([
        result.category,
      ]),
    });
  } catch (error) {
    console.error("Category detection error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/books/analyze
// @desc    Analyze a book for category detection and content analysis
// @access  Private
router.post("/analyze", auth, async (req, res) => {
  try {
    const { bookId } = req.body;

    if (!bookId) {
      return res.status(400).json({ message: "Book ID is required" });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Check if user owns the book or is admin
    if (
      book.uploadedBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to analyze this book" });
    }

    // Perform analysis
    const pdfPath = book.localPdfPath
      ? path.join(__dirname, "../uploads/pdfs", book.localPdfPath)
      : null;
    const result = await categoryDetection.detectCategory(
      book.title,
      book.summary,
      pdfPath
    );

    // Update book with new analysis
    book.category = result.category;
    book.categoryConfidence = result.confidence;
    book.analysisMethod = result.analysisMethod;
    await book.save();

    res.json({
      message: "Book analyzed successfully",
      analysis: {
        category: result.category,
        confidence: result.confidence,
        analysisMethod: result.analysisMethod,
        allScores: result.allScores,
        previousCategory: book.category,
        previousConfidence: book.categoryConfidence,
      },
      book: book,
    });
  } catch (error) {
    console.error("Book analysis error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/books/temp-upload
// @desc    Temporary upload for PDF analysis
// @access  Private
router.post("/temp-upload", [auth, uploadBookSimple], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "PDF file is required" });
    }

    // Save file temporarily
    const uploadsDir = path.join(__dirname, "../uploads");
    const pdfsDir = path.join(uploadsDir, "pdfs");

    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const localFileName = `temp_${timestamp}.pdf`;
    const localPdfPath = path.join(pdfsDir, localFileName);

    // Save file
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.copyFileSync(req.file.path, localPdfPath);
    } else if (req.file?.buffer) {
      fs.writeFileSync(localPdfPath, req.file.buffer);
    }

    res.json({
      message: "File uploaded temporarily",
      fileName: localFileName,
      path: localPdfPath,
    });
  } catch (error) {
    console.error("Temp upload error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/books/extract-info
// @desc    Extract book information from PDF file
// @access  Private
router.post("/extract-info", auth, async (req, res) => {
  try {
    const { pdfPath } = req.body;

    if (!pdfPath) {
      return res.status(400).json({ message: "PDF path is required" });
    }

    const fullPdfPath = path.join(__dirname, "../uploads/pdfs", pdfPath);

    if (!fs.existsSync(fullPdfPath)) {
      return res.status(404).json({ message: "PDF file not found" });
    }

    // Extract book information from PDF
    const extractedInfo = await pdfAnalysis.extractBookMetadata(fullPdfPath);

    // Also detect category
    const categoryResult = await categoryDetection.detectCategory(
      extractedInfo.title,
      extractedInfo.summary,
      fullPdfPath
    );

    res.json({
      message: "Book information extracted successfully",
      extractedInfo: {
        ...extractedInfo,
        category: categoryResult.category,
        categoryConfidence: categoryResult.confidence,
        analysisMethod: categoryResult.analysisMethod,
      },
    });
  } catch (error) {
    console.error("PDF info extraction error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/books/categories
// @desc    Get all available book categories
// @access  Public
router.get("/categories", async (req, res) => {
  try {
    const categories = categoryDetection.getPopularCategories();
    res.json({ categories });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/books/recommendations
// @desc    Get ML-based book recommendations for the current user
// @access  Private
router.get("/recommendations", auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const user = req.user;

    // Get user's interaction history
    const Like = require("../models/Like");
    const Bookmark = require("../models/Bookmark");
    const Comment = require("../models/Comment");

    const [likedBooks, bookmarkedBooks, commentedBooks] = await Promise.all([
      Like.find({ user: user._id }).populate("book").lean(),
      Bookmark.find({ user: user._id }).populate("book").lean(),
      Comment.find({ user: user._id }).populate("book").lean(),
    ]);

    // Extract user preferences
    const allInteractedBooks = [
      ...likedBooks.map((l) => l.book).filter(Boolean),
      ...bookmarkedBooks.map((b) => b.book).filter(Boolean),
      ...commentedBooks.map((c) => c.book).filter(Boolean),
    ];

    // Remove duplicates
    const uniqueBooks = [];
    const seenIds = new Set();
    for (const book of allInteractedBooks) {
      if (!seenIds.has(book._id.toString())) {
        seenIds.add(book._id.toString());
        uniqueBooks.push(book);
      }
    }

    // Extract preferences
    const likedCategories = [
      ...new Set(uniqueBooks.map((b) => b.category).filter(Boolean)),
    ];
    const likedAuthors = [
      ...new Set(uniqueBooks.map((b) => b.author).filter(Boolean)),
    ];
    const likedTags = [
      ...new Set(uniqueBooks.flatMap((b) => b.tags || []).filter(Boolean)),
    ];

    // Build ML recommendation query
    const mlQuery = {
      status: "published",
      isApproved: true,
      isGlobal: true, // Include all globally visible books
      uploadedBy: { $ne: user._id }, // Exclude own books
      _id: { $nin: uniqueBooks.map((b) => b._id) }, // Exclude already interacted books
    };

    // Add ML conditions
    const mlConditions = [];
    if (likedCategories.length > 0) {
      mlConditions.push({ category: { $in: likedCategories } });
    }
    if (likedAuthors.length > 0) {
      mlConditions.push({ author: { $in: likedAuthors } });
    }
    if (likedTags.length > 0) {
      mlConditions.push({ tags: { $in: likedTags } });
    }

    if (mlConditions.length > 0) {
      mlQuery.$or = mlConditions;
    }

    // Get recommendations
    const recommendations = await Book.find(mlQuery)
      .populate("uploadedBy", "username profilePicture followers")
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // If not enough recommendations, fill with popular books
    if (recommendations.length < limit) {
      const additionalBooks = await Book.find({
        status: "published",
        isApproved: true,
        isGlobal: true,
        uploadedBy: { $ne: user._id },
        _id: {
          $nin: [
            ...uniqueBooks.map((b) => b._id),
            ...recommendations.map((b) => b._id),
          ],
        },
      })
        .populate("uploadedBy", "username profilePicture followers")
        .sort({ viewCount: -1, createdAt: -1 })
        .limit(limit - recommendations.length)
        .lean();

      recommendations.push(...additionalBooks);
    }

    res.json({
      recommendations,
      userPreferences: {
        likedCategories,
        likedAuthors,
        likedTags,
        totalInteractions: uniqueBooks.length,
      },
    });
  } catch (error) {
    console.error("ML recommendations error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/books/:id/toggle-global
// @desc    Toggle global visibility of a book (Admin only)
// @access  Private/Admin
router.post("/:id/toggle-global", [auth, admin], async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book ID format" });
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Toggle global visibility
    book.isGlobal = !book.isGlobal;
    await book.save();

    // Broadcast notification via SSE
    try {
      const sseClients = req.app.get("sseClients");
      const payload = JSON.stringify({
        type: "book_global_toggled",
        message: `Book ${
          book.isGlobal
            ? "made globally visible"
            : "removed from global visibility"
        }: ${book.title}`,
        createdAt: Date.now(),
        bookId: book._id,
        isGlobal: book.isGlobal,
      });
      for (const client of sseClients) {
        client.write(`event: notification\ndata: ${payload}\n\n`);
      }
    } catch (_) {}

    res.json({
      message: `Book ${
        book.isGlobal
          ? "made globally visible"
          : "removed from global visibility"
      } successfully!`,
      book,
    });
  } catch (error) {
    console.error("Toggle book global visibility error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/books/local
// @desc    Create a new book with local storage upload (Authenticated users)
// @access  Private
router.post(
  "/local",
  [auth, b2Upload.single("pdf")],
  [body("title").notEmpty().withMessage("Title is required")],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, category: userSelectedCategory } = req.body;

      console.log("Creating book with local storage upload, title:", title);
      console.log("Local file:", req.file);

      // Get PDF URL from local upload
      let pdfUrl = "";
      if (req.file) {
        pdfUrl = `/uploads/pdfs/${req.file.filename}`;
        console.log("File stored locally:", pdfUrl);
      } else {
        console.log("No file provided in request");
      }

      // Create book with default values
      // Prefer user-selected category; otherwise auto-detect
      let detectedCategory = userSelectedCategory || "Other";
      let categoryConfidence = userSelectedCategory ? 1.0 : 0.5;

      if (!userSelectedCategory) {
        try {
          const categoryResult = await categoryDetection.detectCategory(
            title,
            "No summary provided."
          );
          detectedCategory = categoryResult.category;
          categoryConfidence = categoryResult.confidence;
        } catch (error) {
          console.error("Category detection failed:", error);
        }
      }

      const bookData = {
        title,
        author: "Unknown Author", // Default value
        category: detectedCategory,
        categoryConfidence, // Store confidence score
        summary: "No summary provided.", // Default value
        thumbnail: "", // No thumbnail for user uploads
        pdfUrl,
        language: "English", // Default value
        uploadedBy: req.user._id,
        isApproved: true, // Auto-approve all user uploads for now
        status: "published", // Auto-publish all user uploads
        isAdminShared: req.user.role === "admin", // Mark as admin-shared if uploaded by admin
        isGlobal: true, // All books are globally visible by default
      };

      console.log("Creating book with data:", bookData);

      const book = new Book(bookData);
      await book.save();

      console.log("Book saved successfully:", book._id);

      const message = "Book uploaded and published successfully!";
      res.status(201).json({
        message,
        book,
      });
    } catch (error) {
      console.error("Create book error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
