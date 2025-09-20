import { useRef, useCallback } from 'react';

// Global request throttling map
const requestThrottleMap = new Map();

// Custom hook for throttled API requests
export const useThrottledRequest = (throttleMs = 2000) => {
  const lastRequestTime = useRef(0);
  
  const throttledRequest = useCallback(async (requestFn, requestKey = 'default') => {
    const now = Date.now();
    const lastTime = requestThrottleMap.get(requestKey) || 0;
    
    // Check if enough time has passed since last request
    if (now - lastTime < throttleMs) {
      console.log(`Throttling request: ${requestKey}, waiting ${throttleMs - (now - lastTime)}ms`);
      return Promise.resolve(null); // Return null for throttled requests
    }
    
    // Update last request time
    requestThrottleMap.set(requestKey, now);
    
    try {
      return await requestFn();
    } catch (error) {
      // Reset throttle on error
      requestThrottleMap.delete(requestKey);
      throw error;
    }
  }, [throttleMs]);
  
  return throttledRequest;
};

// Hook for component-level request deduplication
export const useRequestDeduplication = () => {
  const pendingRequests = useRef(new Map());
  
  const deduplicatedRequest = useCallback(async (requestFn, requestKey) => {
    // Check if request is already pending
    if (pendingRequests.current.has(requestKey)) {
      console.log(`Deduplicating request: ${requestKey}`);
      return pendingRequests.current.get(requestKey);
    }
    
    // Create new request
    const requestPromise = requestFn().finally(() => {
      // Clean up pending request
      pendingRequests.current.delete(requestKey);
    });
    
    // Store pending request
    pendingRequests.current.set(requestKey, requestPromise);
    
    return requestPromise;
  }, []);
  
  return deduplicatedRequest;
};

export default useThrottledRequest;
