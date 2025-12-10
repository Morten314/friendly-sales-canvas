
import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('=== ERROR BOUNDARY CAUGHT ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    
    // Check for React error #31 specifically
    if (error.message && error.message.includes('invariant=31')) {
      console.error('🚨 REACT ERROR #31 DETECTED - Object passed as React child');
      console.error('This usually means an object with keys like {channel, channelMix} is being rendered directly');
    }
    
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('=== COMPONENT ERROR DETAILS ===');
    console.error('Error:', error.message);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Component Name:', this.props.componentName || 'Unknown');
    
    // Additional debugging for React error #31
    if (error.message && error.message.includes('invariant=31')) {
      console.error('🔍 DEBUGGING REACT ERROR #31:');
      console.error('- Check for objects being rendered directly in JSX');
      console.error('- Look for {channel, channelMix} objects in render methods');
      console.error('- Ensure all rendered values are strings, numbers, or valid React elements');
    }
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    console.log('=== RESETTING ERROR BOUNDARY ===');
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackMessage = "Something went wrong with this component", componentName } = this.props;
      
      return (
        <Card className="border-red-200 bg-red-50/40 m-4">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Component Error {componentName && `- ${componentName}`}
            </CardTitle>
            <CardDescription className="text-red-700">
              {fallbackMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-red-200">
              <p className="text-sm text-gray-700 font-medium mb-2">Error Details:</p>
              <p className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                {this.state.error?.message || 'Unknown error'}
              </p>
              {this.state.error?.message?.includes('invariant=31') && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800 font-medium">React Error #31 Detected:</p>
                  <p className="text-xs text-yellow-700">
                    An object is being rendered as a React child. Check for objects like &#123;channel, channelMix, trigger, description&#125; being passed to JSX.
                  </p>
                </div>
              )}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-2">
                  <summary className="text-sm text-gray-600 cursor-pointer">Stack Trace</summary>
                  <pre className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded overflow-x-auto">
                    {this.state.error?.stack}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={this.handleReset} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
