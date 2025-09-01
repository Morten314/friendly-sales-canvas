import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import { rateLimitManager } from '@/lib/rateLimitManager';
import { enhancedApi } from '@/lib/enhancedApi';

interface RateLimitStatusProps {
  className?: string;
}

export const RateLimitStatus = ({ className }: RateLimitStatusProps) => {
  const [status, setStatus] = useState(rateLimitManager.getQueueStatus());
  const [cacheStats, setCacheStats] = useState(enhancedApi.getCacheStats());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setStatus(rateLimitManager.getQueueStatus());
      setCacheStats(enhancedApi.getCacheStats());
    };

    // Update status every second
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setStatus(rateLimitManager.getQueueStatus());
    setCacheStats(enhancedApi.getCacheStats());
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleClearQueue = () => {
    rateLimitManager.clearQueue();
    setStatus(rateLimitManager.getQueueStatus());
  };

  const handleClearCache = () => {
    enhancedApi.clearCache();
    setCacheStats(enhancedApi.getCacheStats());
  };

  const usagePercentage = (status.requestsThisMinute / status.maxRequestsPerMinute) * 100;
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 100;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">API Rate Limit Status</CardTitle>
            <CardDescription className="text-xs">
              Managing requests to prevent rate limiting
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Rate Limit Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Requests this minute</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{status.requestsThisMinute}</span>
              <span className="text-muted-foreground">/ {status.maxRequestsPerMinute}</span>
            </div>
          </div>
          
          <Progress 
            value={usagePercentage} 
            className="h-2"
            style={{
              '--progress-background': isAtLimit ? 'hsl(var(--destructive))' : 
                                     isNearLimit ? 'hsl(var(--warning))' : 
                                     'hsl(var(--primary))'
            } as React.CSSProperties}
          />
          
          {isAtLimit && (
            <Alert className="border-destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Rate limit reached. New requests will be queued.
              </AlertDescription>
            </Alert>
          )}
          
          {isNearLimit && !isAtLimit && (
            <Alert className="border-warning">
              <Clock className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Approaching rate limit. Consider spacing out requests.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Queue Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Request Queue</span>
            <Badge variant={status.queueLength > 0 ? "secondary" : "outline"}>
              {status.queueLength} pending
            </Badge>
          </div>
          
          {status.isProcessing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Processing requests...
            </div>
          )}
        </div>

        {/* Cache Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Cached Responses</span>
            <Badge variant="outline">
              {cacheStats.size} items
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearQueue}
            disabled={status.queueLength === 0}
            className="flex-1"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear Queue
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            disabled={cacheStats.size === 0}
            className="flex-1"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear Cache
          </Button>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            {status.isProcessing ? (
              <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
            ) : (
              <CheckCircle className="h-3 w-3 text-green-500" />
            )}
            <span className="text-muted-foreground">
              {status.isProcessing ? 'Processing' : 'Ready'}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {isAtLimit ? (
              <XCircle className="h-3 w-3 text-red-500" />
            ) : (
              <CheckCircle className="h-3 w-3 text-green-500" />
            )}
            <span className="text-muted-foreground">
              {isAtLimit ? 'Rate Limited' : 'Within Limits'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
