import axios from 'axios';
import requestBlocker from './requestBlocker';

// Simple request cache to prevent duplicate requests
const requestCache = new Map();
const pendingRequests = new Map();

// Resolve API base URL:
// - In production, set VITE_API_BASE_URL to your backend, e.g. https://api.yourdomain.com/api
// - In dev, Vite proxy can handle '/api' to local backend
const resolvedBaseURL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : '/api';

// Create axios instance
const api = axios.create({
  baseURL: resolvedBaseURL,
  timeout: 60000, // Increased to 60 seconds for PDF uploads
  withCredentials: true,
});

// Simple request interceptor for deduplication and blocking
api.interceptors.request.use(
  async (config) => {
    const endpoint = config.url?.split('?')[0] || '';
    const method = config.method || 'GET';
    const requestKey = `${method}:${endpoint}`;
    
    // Check if endpoint is blocked
    if (requestBlocker.isBlocked(endpoint)) {
      console.log(`Blocking request to blocked endpoint: ${endpoint}`);
      return Promise.reject(new Error(`Endpoint ${endpoint} is blocked`));
    }
    
    // Check if request should be blocked due to rate limiting
    if (requestBlocker.shouldBlock(endpoint)) {
      console.log(`Blocking request due to rate limit: ${endpoint}`);
      return Promise.reject(new Error(`Rate limit exceeded for ${endpoint}`));
    }
    
    // Skip deduplication for certain endpoints
    const skipDeduplication = [
      '/users/me/ping',
      '/auth/me',
      '/chats/typing',
    ];
    
    // Set longer timeout for upload endpoints
    if (endpoint.includes('/books') && config.method === 'POST') {
      config.timeout = 120000; // 2 minutes for book uploads
    }
    
    // Check if request is already pending
    if (!skipDeduplication.some(skip => endpoint.includes(skip))) {
      if (pendingRequests.has(requestKey)) {
        console.log(`Blocking duplicate request: ${requestKey}`);
        // Return a promise that never resolves to block the request
        return new Promise(() => {});
      }
      
      // Mark request as pending
      pendingRequests.set(requestKey, true);
      
      // Set timeout to clear pending status
      const clearTimeout = endpoint.includes('/books') && config.method === 'POST' ? 120000 : 5000;
      setTimeout(() => {
        pendingRequests.delete(requestKey);
      }, clearTimeout);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and cleanup
api.interceptors.response.use(
  (response) => {
    // Clear pending request on successful response
    const endpoint = response.config.url?.split('?')[0] || '';
    const method = response.config.method || 'GET';
    const requestKey = `${method}:${endpoint}`;
    pendingRequests.delete(requestKey);
    
    return response;
  },
  (error) => {
    // Clear pending request on error
    if (error.config) {
      const endpoint = error.config.url?.split('?')[0] || '';
      const method = error.config.method || 'GET';
      const requestKey = `${method}:${endpoint}`;
      pendingRequests.delete(requestKey);
    }
    
    if (error.response?.status === 429) {
      console.log('Rate limited, backing off...');
    }
    return Promise.reject(error);
  }
);

export default api;
