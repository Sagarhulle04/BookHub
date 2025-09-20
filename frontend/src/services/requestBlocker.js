// Simple request blocker to prevent excessive API calls
class RequestBlocker {
  constructor() {
    this.blockedRequests = new Set();
    this.requestCounts = new Map();
    this.maxRequestsPerMinute = 10; // Very aggressive limit
    this.requestHistory = new Map();
  }

  // Check if request should be blocked
  shouldBlock(endpoint) {
    const now = Date.now();
    const minuteAgo = now - 60000;
    
    // Get request history for this endpoint
    if (!this.requestHistory.has(endpoint)) {
      this.requestHistory.set(endpoint, []);
    }
    
    const history = this.requestHistory.get(endpoint);
    
    // Remove old requests
    const recentRequests = history.filter(timestamp => timestamp > minuteAgo);
    this.requestHistory.set(endpoint, recentRequests);
    
    // Block if too many requests
    if (recentRequests.length >= this.maxRequestsPerMinute) {
      console.warn(`BLOCKING request to ${endpoint} - too many requests (${recentRequests.length})`);
      return true;
    }
    
    // Add current request
    recentRequests.push(now);
    return false;
  }

  // Block a specific endpoint
  blockEndpoint(endpoint) {
    this.blockedRequests.add(endpoint);
    console.log(`Blocked endpoint: ${endpoint}`);
  }

  // Unblock a specific endpoint
  unblockEndpoint(endpoint) {
    this.blockedRequests.delete(endpoint);
    console.log(`Unblocked endpoint: ${endpoint}`);
  }

  // Check if endpoint is blocked
  isBlocked(endpoint) {
    return this.blockedRequests.has(endpoint);
  }

  // Clear all blocks
  clearAll() {
    this.blockedRequests.clear();
    this.requestHistory.clear();
  }

  // Get statistics
  getStats() {
    const stats = {};
    for (const [endpoint, history] of this.requestHistory.entries()) {
      const now = Date.now();
      const minuteAgo = now - 60000;
      stats[endpoint] = history.filter(timestamp => timestamp > minuteAgo).length;
    }
    return stats;
  }
}

// Global instance
const requestBlocker = new RequestBlocker();

// Block problematic endpoints
requestBlocker.blockEndpoint('/users/suggestions'); // This endpoint returns 404 anyway

export default requestBlocker;
