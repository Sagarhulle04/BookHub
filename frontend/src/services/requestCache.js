import { throttledFetch } from './requestThrottle';

// Request cache service to prevent duplicate API calls
class RequestCache {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
  }

  // Generate cache key from URL and options
  getCacheKey(url, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  // Check if request is already pending
  isPending(key) {
    return this.pendingRequests.has(key);
  }

  // Add pending request
  addPending(key, promise) {
    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Remove pending request
  removePending(key) {
    this.pendingRequests.delete(key);
  }

  // Get cached response
  get(key) {
    return this.cache.get(key);
  }

  // Set cached response
  set(key, data, ttl = 30000) { // 30 seconds default TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // Check if cached data is still valid
  isValid(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < cached.ttl;
  }

  // Clear expired cache entries
  clearExpired() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if ((now - value.timestamp) >= value.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Clear all cache
  clear() {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

// Global request cache instance
const requestCache = new RequestCache();

// Enhanced fetch with caching and deduplication
export const cachedFetch = async (url, options = {}) => {
  const key = requestCache.getCacheKey(url, options);
  
  // Check if we have valid cached data
  if (requestCache.isValid(key)) {
    return requestCache.get(key).data;
  }

  // Check if request is already pending
  if (requestCache.isPending(key)) {
    return requestCache.pendingRequests.get(key);
  }

  // Make the request with throttling
  const promise = throttledFetch(url, options)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Cache successful responses
      requestCache.set(key, data);
      requestCache.removePending(key);
      return data;
    })
    .catch(error => {
      requestCache.removePending(key);
      throw error;
    });

  // Add to pending requests
  requestCache.addPending(key, promise);
  
  return promise;
};

// Clear cache periodically
setInterval(() => {
  requestCache.clearExpired();
}, 60000); // Clear every minute

export default requestCache;
