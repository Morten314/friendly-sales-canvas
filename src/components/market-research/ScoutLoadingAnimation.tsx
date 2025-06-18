import React from 'react';
import { Search, Brain, Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export const ScoutLoadingAnimation = () => {
  return (
    <Card className="mb-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              {/* Scout Icon with pulsing animation */}
              <div className="p-2 bg-blue-500 text-white rounded-full animate-pulse">
                <Search className="h-5 w-5" />
              </div>
              {/* Scanning effect */}
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-ping"></div>
            </div>
            
            <div>
              <h4 className="font-semibold text-blue-900">Scout is analyzing new data...</h4>
              <p className="text-sm text-blue-700">Processing your company profile updates</p>
            </div>
          </div>
          
          {/* Activity indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Brain className="h-4 w-4 animate-pulse" />
              <span className="text-xs font-medium">Analyzing</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-600">
              <Zap className="h-4 w-4 animate-bounce" />
              <span className="text-xs font-medium">Processing</span>
            </div>
            <div className="flex items-center gap-2 text-teal-600">
              <TrendingUp className="h-4 w-4 animate-pulse" />
              <span className="text-xs font-medium">Updating</span>
            </div>
          </div>
        </div>
        
        {/* Progress bar animation */}
        <div className="mt-3 w-full bg-blue-100 rounded-full h-2">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full animate-pulse" 
               style={{ 
                 width: '100%', 
                 animation: 'loading-bar 2s ease-in-out infinite' 
               }}>
          </div>
        </div>
        
        {/* Custom animation styles */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes loading-bar {
              0% { width: 0%; }
              50% { width: 70%; }
              100% { width: 100%; }
            }
          `
        }} />
      </CardContent>
    </Card>
  );
};