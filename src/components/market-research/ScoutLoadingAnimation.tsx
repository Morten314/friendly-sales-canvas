
import React, { useState, useEffect } from 'react';
import { Search, Brain, Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export const ScoutLoadingAnimation = () => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    { icon: Brain, text: "Analyzing", color: "text-blue-600" },
    { icon: Zap, text: "Processing", color: "text-cyan-600" },
    { icon: TrendingUp, text: "Updating", color: "text-teal-600" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 150); // Much faster for testing

    return () => clearInterval(interval);
  }, []);

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
          
          {/* Progressive activity indicators */}
          <div className="flex items-center gap-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index <= currentStep;
              const isCurrent = index === currentStep;
              
              return (
                <div 
                  key={index}
                  className={`flex items-center gap-2 transition-all duration-300 ${
                    isActive ? step.color : 'text-gray-400'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isCurrent ? 'animate-bounce' : isActive ? 'animate-pulse' : ''}`} />
                  <span className={`text-xs font-medium transition-opacity duration-300 ${
                    isActive ? 'opacity-100' : 'opacity-50'
                  }`}>
                    {step.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Progress bar animation */}
        <div className="mt-3 w-full bg-blue-100 rounded-full h-2">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" 
               style={{ 
                 width: '100%', 
                 animation: 'loading-bar 1.5s ease-in-out infinite' 
               }}>
          </div>
        </div>
        
        {/* Custom animation styles */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes loading-bar {
              0% { width: 15%; }
              50% { width: 85%; }
              100% { width: 100%; }
            }
          `
        }} />
      </CardContent>
    </Card>
  );
};
