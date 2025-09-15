interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
}

interface QueuedRequest {
  id: string;
  apiCall: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  retryCount: number;
}

class RateLimitManager {
  private config: RateLimitConfig;
  private requestQueue: QueuedRequest[] = [];
  private requestHistory: { timestamp: number }[] = [];
  private isProcessing = false;
  private currentDelay = 0;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRequestsPerMinute: 120, // Even higher for faster parallel loading
      maxRetries: 1, // Minimal retries for faster failure handling
      baseDelayMs: 25, // Very minimal delay for faster processing
      maxDelayMs: 500, // Much reduced for faster processing
      jitterMs: 10, // Minimal jitter for more predictable timing
      ...config
    };
  }

  private cleanupOldRequests() {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestHistory = this.requestHistory.filter(
      req => req.timestamp > oneMinuteAgo
    );
  }

  private canMakeRequest(): boolean {
    this.cleanupOldRequests();
    return this.requestHistory.length < this.config.maxRequestsPerMinute;
  }

  private addRequestToHistory() {
    this.requestHistory.push({ timestamp: Date.now() });
  }

  private calculateDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.config.baseDelayMs * Math.pow(2, retryCount),
      this.config.maxDelayMs
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterMs;
    
    return exponentialDelay + jitter;
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        // Check if we can make a request
        if (!this.canMakeRequest()) {
          // Put the request back at the front of the queue
          this.requestQueue.unshift(request);
          
          // Wait for the next available slot
          const waitTime = 60000 - (Date.now() - this.requestHistory[0]?.timestamp || 0);
          if (waitTime > 0) {
            console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s before next request...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          continue;
        }

        // Add to history and make the request
        this.addRequestToHistory();
        console.log(`🚀 Making API request (${this.requestHistory.length}/${this.config.maxRequestsPerMinute} this minute)`);
        
        const result = await request.apiCall();
        request.resolve(result);

      } catch (error) {
        console.error(`❌ API request failed:`, error);
        
        // Check if it's a rate limit error
        const isRateLimitError = this.isRateLimitError(error);
        
        if (isRateLimitError && request.retryCount < this.config.maxRetries) {
          // Put back in queue with increased retry count
          request.retryCount++;
          const delay = this.calculateDelay(request.retryCount);
          console.log(`🔄 Rate limit hit. Retrying in ${Math.ceil(delay / 1000)}s (attempt ${request.retryCount}/${this.config.maxRetries})`);
          
          setTimeout(() => {
            this.requestQueue.unshift(request);
            this.processQueue();
          }, delay);
        } else {
          // Max retries reached or non-rate-limit error
          request.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  private isRateLimitError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message || error.toString();
    return (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429') ||
      errorMessage.includes('model_rate_limit') ||
      errorMessage.includes('DeepSeek-R1-Distill-Llama-70B-free')
    );
  }

  async executeWithRateLimit<T>(
    apiCall: () => Promise<T>,
    componentName: string = 'Unknown'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${componentName}-${Date.now()}-${Math.random()}`,
        apiCall,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0
      };

      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  // Utility method to check current queue status
  getQueueStatus() {
    return {
      queueLength: this.requestQueue.length,
      requestsThisMinute: this.requestHistory.length,
      maxRequestsPerMinute: this.config.maxRequestsPerMinute,
      isProcessing: this.isProcessing
    };
  }

  // Method to clear queue (useful for testing or emergency situations)
  clearQueue() {
    this.requestQueue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.requestQueue = [];
  }
}

// Create a singleton instance
export const rateLimitManager = new RateLimitManager();

// Export the class for testing or custom instances
export { RateLimitManager };

// Utility function for components to use
export const executeWithRateLimit = async <T>(
  apiCall: () => Promise<T>,
  componentName: string = 'Unknown'
): Promise<T> => {
  return rateLimitManager.executeWithRateLimit(apiCall, componentName);
};
