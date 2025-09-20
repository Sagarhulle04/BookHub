const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const bookRoutes = require("./routes/books");
const commentRoutes = require("./routes/comments");
const likeRoutes = require("./routes/likes");
const bookmarkRoutes = require("./routes/bookmarks");
const chatRoutes = require("./routes/chats");
const statusRoutes = require("./routes/status");
const highlightRoutes = require("./routes/highlights");
const notificationRoutes = require("./routes/notifications");
const userPreferencesRoutes = require("./routes/userPreferences");

const app = express();
// Keep a simple in-memory list of SSE clients
const sseClients = new Set();
app.set("sseClients", sseClients);

// Security middleware
app.use(helmet());

// Rate limiting - enabled with reasonable limits
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 500, // Reasonable limits for development
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
const parseOrigins = (value) => {
  if (!value) return null;
  try {
    // support comma-separated or JSON array
    if (value.trim().startsWith("[")) {
      const arr = JSON.parse(value);
      return Array.isArray(arr) ? arr : null;
    }
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (_) {
    return null;
  }
};

const prodOrigins = parseOrigins(process.env.FRONTEND_ORIGINS) || [
  "https://yourdomain.com",
];
const devOrigins = ["http://localhost:3000", "http://localhost:5173"];

app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? prodOrigins : devOrigins,
    credentials: true,
  })
);

// If behind a proxy/load-balancer (nginx), trust proxy for correct protocol/host
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Static file serving for local uploads
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/highlights", highlightRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/user-preferences", userPreferencesRoutes);

// SSE notifications stream
app.get("/api/notifications/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders && res.flushHeaders();

  const client = res;
  sseClients.add(client);

  // Heartbeat to keep the connection alive
  const intervalId = setInterval(() => {
    try {
      client.write(`event: ping\ndata: ${Date.now()}\n\n`);
    } catch (_) {}
  }, 30000);

  req.on("close", () => {
    clearInterval(intervalId);
    sseClients.delete(client);
  });
});

// Basic robots.txt and sitemap.xml (dynamic)
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *
Allow: /
Sitemap: ${req.protocol}://${req.get("host")}/sitemap.xml
`);
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const Book = require("./models/Book");
    const books = await Book.find({ status: "published", isApproved: true })
      .select("_id updatedAt")
      .lean();
    const base = `${req.protocol}://${req.get("host")}`;
    const urls = [
      { loc: `${base}/`, changefreq: "daily", priority: 1.0 },
      { loc: `${base}/search`, changefreq: "daily", priority: 0.8 },
    ].concat(
      books.map((b) => ({
        loc: `${base}/books/${b._id}`,
        lastmod: new Date(b.updatedAt).toISOString(),
        changefreq: "weekly",
        priority: 0.7,
      }))
    );
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(
        (u) =>
          `  <url><loc>${u.loc}</loc>${
            u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""
          }<changefreq>${u.changefreq}</changefreq><priority>${
            u.priority
          }</priority></url>`
      ),
      "</urlset>",
    ].join("\n");
    res.type("application/xml").send(body);
  } catch (e) {
    res
      .type("application/xml")
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
      );
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ message: "BookHub API is running!" });
});

// Serve frontend SPA (static files)
// const frontendDistPath = path.join(__dirname, "..", "frontend", "dist");
// app.use(express.static(frontendDistPath));

// History API fallback for SPA routes (non-API)
// app.get(["/", /^\/(?!api\/).*/], (req, res) => {
//   res.sendFile(path.join(frontendDistPath, "index.html"));
// });

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// Connect to MongoDB
// console.log("MONGODB_URI:", process.env.MONGODB_URI);
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB");

    // Cleanup expired unverified users on startup
    try {
      const User = require("./models/User");
      const now = new Date();
      const result = await User.deleteMany({
        isVerified: false,
        verificationExpires: { $lt: now },
      });
      if (result.deletedCount > 0) {
        console.log(
          `Cleaned up ${result.deletedCount} expired unverified users`
        );
      }
    } catch (err) {
      console.error("Error cleaning up unverified users:", err);
    }

    const PORT = process.env.PORT || 5001;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
