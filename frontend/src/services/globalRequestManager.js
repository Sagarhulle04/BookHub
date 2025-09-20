// Global request manager to prevent duplicate requests across the entire application
class GlobalRequestManager {
  constructor() {
    this.pendingRequests = new Map();
    this.requestCounts = new Map();
    this.maxRequestsPerMinute = 60; // Maximum 60 requests per minute per endpoint
    this.requestHistory = new Map(); // Track request history for rate limiting
  }

  // Generate a unique key for the request
  getRequestKey(url, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  // Check if we should allow this request based on rate limiting
  shouldAllowRequest(endpoint) {
    const now = Date.now();
    const minuteAgo = now - 60000; // 1 minute ago
    
    // Get or create request history for this endpoint
    if (!this.requestHistory.has(endpoint)) {
      this.requestHistory.set(endpoint, []);
    }
    
    const history = this.requestHistory.get(endpoint);
    
    // Remove requests older than 1 minute
    const recentRequests = history.filter(timestamp => timestamp > minuteAgo);
    this.requestHistory.set(endpoint, recentRequests);
    
    // Check if we've exceeded the rate limit
    if (recentRequests.length >= this.maxRequestsPerMinute) {
      console.warn(`Rate limit exceeded for ${endpoint}. Blocking request.`);
      return false;
    }
    
    // Add current request to history
    recentRequests.push(now);
    return true;
  }

  // Check if request is already pending
  isRequestPending(key) {
    return this.pendingRequests.has(key);
  }

  // Add pending request
  addPendingRequest(key, promise) {
    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Remove pending request
  removePendingRequest(key) {
    this.pendingRequests.delete(key);
  }

  // Get pending request
  getPendingRequest(key) {
    return this.pendingRequests.get(key);
  }

  // Clear all pending requests
  clearAllPending() {
    this.pendingRequests.clear();
  }

  // Clear request history
  clearHistory() {
    this.requestHistory.clear();
  }

  // Get request statistics
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      endpointCounts: Object.fromEntries(this.requestHistory.entries().map(([endpoint, history]) => [
        endpoint, 
        history.filter(timestamp => timestamp > Date.now() - 60000).length
      ]))
    };
  }
}

// Global instance
const globalRequestManager = new GlobalRequestManager();

// Enhanced fetch with global deduplication and rate limiting
export const managedFetch = async (url, options = {}) => {
  const key = globalRequestManager.getRequestKey(url, options);
  const endpoint = url.split('?')[0]; // Remove query params for rate limiting
  
  // Check if request is already pending
  if (globalRequestManager.isRequestPending(key)) {
    console.log(`Reusing pending request for ${url}`);
    return globalRequestManager.getPendingRequest(key);
  }
  
  // Check rate limiting
  if (!globalRequestManager.shouldAllowRequest(endpoint)) {
    throw new Error(`Rate limit exceeded for ${endpoint}`);
  }
  
  // Make the request
  const promise = fetch(url, options)
    .then(response => {
      globalRequestManager.removePendingRequest(key);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .catch(error => {
      globalRequestManager.removePendingRequest(key);
      throw error;
    });
  
  // Add to pending requests
  globalRequestManager.addPendingRequest(key, promise);
  
  return promise;
};

// Clear old request history periodically
setInterval(() => {
  const now = Date.now();
  const minuteAgo = now - 60000;
  
  for (const [endpoint, history] of globalRequestManager.requestHistory.entries()) {
    const recentHistory = history.filter(timestamp => timestamp > minuteAgo);
    if (recentHistory.length === 0) {
      globalRequestManager.requestHistory.delete(endpoint);
    } else {
      globalRequestManager.requestHistory.set(endpoint, recentHistory);
    }
  }
}, 30000); // Clean up every 30 seconds

export default globalRequestManager;
