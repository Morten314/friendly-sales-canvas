// The single shared rate limiter for the whole app (spec 20 §3.2).
// Logic moved here from src/lib/rateLimitManager.ts; that module now re-exports
// these symbols as a compatibility shim. Exactly one RateLimiter instance exists
// (this `rateLimiter`); client.ts and the legacy executeWithRateLimit sites both
// draw from it, so legacy + new share one 30/min budget.

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
}

interface QueuedRequest {
  id: string;
  apiCall: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timestamp: number;
  retryCount: number;
}

/** The throttle value preserved from the existing code (was 30/min; spec corrects master-spec "4/min"). */
export const RATE_LIMIT_RPM = 30;

class RateLimitManager {
  private config: RateLimitConfig;
  private requestQueue: QueuedRequest[] = [];
  private requestHistory: { timestamp: number }[] = [];
  private isProcessing = false;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRequestsPerMinute: RATE_LIMIT_RPM, // Increased limit for faster processing
      maxRetries: 1, // Reduced retries for faster failure handling
      baseDelayMs: 500, // Reduced base delay between requests
      maxDelayMs: 2000, // Reduced max delay for retries
      jitterMs: 100, // Reduced jitter for faster processing
      ...config,
    };
  }

  private cleanupOldRequests() {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestHistory = this.requestHistory.filter((req) => req.timestamp > oneMinuteAgo);
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
      this.config.maxDelayMs,
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

          // Wait for the next available slot (but cap at 1 second max for faster processing)
          const waitTime = Math.min(
            60000 - (Date.now() - this.requestHistory[0]?.timestamp || 0),
            1000,
          );
          if (waitTime > 0) {
            console.log(
              `⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s before next request...`,
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
          continue;
        }

        // Add to history and make the request
        this.addRequestToHistory();
        console.log(
          `🚀 Making API request (${this.requestHistory.length}/${this.config.maxRequestsPerMinute} this minute)`,
        );

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
          console.log(
            `🔄 Rate limit hit. Retrying in ${Math.ceil(delay / 1000)}s (attempt ${request.retryCount}/${this.config.maxRetries})`,
          );

          setTimeout(() => {
            this.requestQueue.unshift(request);
            void this.processQueue();
          }, delay);
        } else {
          // Max retries reached or non-rate-limit error
          request.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  private isRateLimitError(error: unknown): boolean {
    if (!error) return false;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = errorMessage.toLowerCase();

    return (
      errorString.includes("rate limit") ||
      errorString.includes("429") ||
      errorString.includes("model_rate_limit") ||
      errorString.includes("deepseek-r1-distill-llama-70b-free") ||
      errorString.includes("too many requests") ||
      errorString.includes("quota exceeded") ||
      errorString.includes("throttled") ||
      errorString.includes("rate_limit_exceeded") ||
      errorString.includes("api rate limit") ||
      errorString.includes("request limit") ||
      errorString.includes("concurrent request limit") ||
      errorString.includes("model rate limit exceeded")
    );
  }

  async executeWithRateLimit<T>(
    apiCall: () => Promise<T>,
    componentName: string = "Unknown",
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${componentName}-${Date.now()}-${Math.random()}`,
        apiCall: apiCall as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
      };

      this.requestQueue.push(request);
      void this.processQueue();
    });
  }

  // Utility method to check current queue status
  getQueueStatus() {
    return {
      queueLength: this.requestQueue.length,
      requestsThisMinute: this.requestHistory.length,
      maxRequestsPerMinute: this.config.maxRequestsPerMinute,
      isProcessing: this.isProcessing,
    };
  }

  // Method to clear queue (useful for testing or emergency situations)
  clearQueue() {
    this.requestQueue.forEach((request) => {
      request.reject(new Error("Queue cleared"));
    });
    this.requestQueue = [];
  }
}

// The single shared instance.
export const rateLimiter = new RateLimitManager({ maxRequestsPerMinute: RATE_LIMIT_RPM });

// Export the class for testing or custom instances.
export { RateLimitManager };

// Utility function for components to use.
export const executeWithRateLimit = async <T>(
  apiCall: () => Promise<T>,
  componentName: string = "Unknown",
): Promise<T> => {
  return rateLimiter.executeWithRateLimit(apiCall, componentName);
};
