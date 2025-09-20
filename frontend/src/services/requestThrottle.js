// Request throttling service to prevent excessive API calls
class RequestThrottle {
  constructor() {
    this.requestTimestamps = new Map();
    this.minInterval = 1000; // Minimum 1 second between requests for same endpoint
    
    // Different throttling intervals for different endpoint types
    this.endpointIntervals = {
      '/api/users/': 5000, // 5 seconds for user profile requests
      '/api/chats': 2000,  // 2 seconds for chat requests
      '/api/notifications': 3000, // 3 seconds for notifications
      '/api/books': 1000,  // 1 second for book requests
    };
  }

  // Check if request should be throttled
  shouldThrottle(endpoint) {
    const now = Date.now();
    const lastRequest = this.requestTimestamps.get(endpoint);
    
    // Get the appropriate interval for this endpoint
    let interval = this.minInterval;
    for (const [prefix, customInterval] of Object.entries(this.endpointIntervals)) {
      if (endpoint.startsWith(prefix)) {
        interval = customInterval;
        break;
      }
    }
    
    if (!lastRequest) {
      this.requestTimestamps.set(endpoint, now);
      return false;
    }
    
    const timeSinceLastRequest = now - lastRequest;
    
    if (timeSinceLastRequest < interval) {
      return true; // Should throttle
    }
    
    this.requestTimestamps.set(endpoint, now);
    return false;
  }

  // Get time until next request is allowed
  getTimeUntilNextRequest(endpoint) {
    const now = Date.now();
    const lastRequest = this.requestTimestamps.get(endpoint);
    
    if (!lastRequest) return 0;
    
    // Get the appropriate interval for this endpoint
    let interval = this.minInterval;
    for (const [prefix, customInterval] of Object.entries(this.endpointIntervals)) {
      if (endpoint.startsWith(prefix)) {
        interval = customInterval;
        break;
      }
    }
    
    const timeSinceLastRequest = now - lastRequest;
    return Math.max(0, interval - timeSinceLastRequest);
  }

  // Clear throttling for an endpoint
  clearThrottle(endpoint) {
    this.requestTimestamps.delete(endpoint);
  }

  // Clear all throttling
  clearAll() {
    this.requestTimestamps.clear();
  }
}

// Global request throttle instance
const requestThrottle = new RequestThrottle();

// Throttled fetch function
export const throttledFetch = async (url, options = {}) => {
  const endpoint = url.split('?')[0]; // Remove query params for throttling
  
  if (requestThrottle.shouldThrottle(endpoint)) {
    const waitTime = requestThrottle.getTimeUntilNextRequest(endpoint);
    console.log(`Throttling request to ${endpoint}, waiting ${waitTime}ms`);
    
    // Wait for the throttling period
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  return fetch(url, options);
};

// Export the requestThrottle instance
export { requestThrottle };
export default requestThrottle;
