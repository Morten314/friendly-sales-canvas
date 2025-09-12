import React from 'react';
import { CheckCircle, XCircle, Loader2, BarChart3, Zap, MapPin, Building2, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ComponentStatus {
  name: string;
  status: 'pending' | 'success' | 'failed';
  icon: React.ComponentType<any>;
}

interface ComponentStatusLoadingScreenProps {
  componentStatus: Record<string, 'pending' | 'success' | 'failed'>;
  refreshAttempt: number;
  maxRetries: number;
  isValidating?: boolean;
  validationAttempt?: number;
  consecutiveValidations?: number;
  loadingPhase?: 'api' | 'rendering' | 'complete';
  componentRenderingStatus?: Record<string, 'pending' | 'rendering' | 'complete'>;
}

export const ComponentStatusLoadingScreen: React.FC<ComponentStatusLoadingScreenProps> = ({
  componentStatus,
  refreshAttempt,
  maxRetries,
  isValidating = false,
  validationAttempt = 0,
  consecutiveValidations = 0,
  loadingPhase = 'api',
  componentRenderingStatus = {}
}) => {
  const components: ComponentStatus[] = [
    { name: 'Market Size', status: componentStatus['Market Size'], icon: BarChart3 },
    { name: 'Industry Trends', status: componentStatus['Industry Trends'], icon: Zap },
    { name: 'Market Entry', status: componentStatus['Market Entry'], icon: MapPin },
    { name: 'Competitor Landscape', status: componentStatus['Competitor Landscape'], icon: Building2 },
    { name: 'Regulatory Compliance', status: componentStatus['Regulatory Compliance'], icon: Shield }
  ];

  const allSuccessful = Object.values(componentStatus).every(status => status === 'success');
  const hasFailures = Object.values(componentStatus).some(status => status === 'failed');
  const isRetrying = hasFailures && refreshAttempt < maxRetries;
  
  // Enhanced status logic for three-phase loading (API -> Validation -> Rendering)
  const getComponentDisplayStatus = (componentName: string) => {
    const apiStatus = componentStatus[componentName];
    const renderingStatus = componentRenderingStatus[componentName];
    
    if (loadingPhase === 'api') {
      return apiStatus;
    } else if (loadingPhase === 'rendering') {
      if (apiStatus === 'failed') return 'failed';
      if (renderingStatus === 'complete') return 'success';
      if (renderingStatus === 'rendering') return 'pending';
      return 'pending';
    } else if (isValidating) {
      // During validation, show loading status regardless of API status
      if (apiStatus === 'failed') return 'failed';
      return 'pending'; // Show loading during validation
    } else {
      return 'success';
    }
  };
  
  const getComponentProgress = (componentName: string) => {
    const apiStatus = componentStatus[componentName];
    const renderingStatus = componentRenderingStatus[componentName];
    
    if (loadingPhase === 'api') {
      return apiStatus === 'success' ? 100 : apiStatus === 'pending' ? 50 : 0;
    } else if (loadingPhase === 'rendering') {
      if (apiStatus === 'failed') return 0;
      if (renderingStatus === 'complete') return 100;
      if (renderingStatus === 'rendering') return 75;
      return 50; // API complete, rendering pending
    } else if (isValidating) {
      // During validation, show 75% progress (API complete, validating)
      if (apiStatus === 'failed') return 0;
      return 75;
    } else {
      return 100;
    }
  };

  const getStatusIcon = (status: 'pending' | 'success' | 'failed') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
      default:
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusBadge = (status: 'pending' | 'success' | 'failed') => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Success</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Loading</Badge>;
    }
  };

  const getOverallStatus = () => {
    if (loadingPhase === 'rendering') {
      const renderedCount = Object.values(componentRenderingStatus).filter(status => status === 'complete').length;
      return {
        title: "Rendering Components... 🎨",
        subtitle: `Building UI with fresh data (${renderedCount}/5 components rendered)`,
        bgColor: "from-purple-50 to-indigo-50",
        borderColor: "border-purple-200"
      };
    } else if (loadingPhase === 'complete') {
      return {
        title: "Scout Ready! 🎉",
        subtitle: "All components loaded and rendered with fresh data",
        bgColor: "from-green-50 to-emerald-50",
        borderColor: "border-green-200"
      };
    } else if (isValidating) {
      return {
        title: "Validating Fresh Data... 🔍",
        subtitle: `Ensuring all components have fresh data (${validationAttempt}/20)`,
        bgColor: "from-purple-50 to-indigo-50",
        borderColor: "border-purple-200"
      };
    } else if (allSuccessful) {
      return {
        title: "API Calls Complete! 🚀",
        subtitle: "Transitioning to rendering phase...",
        bgColor: "from-blue-50 to-cyan-50",
        borderColor: "border-blue-200"
      };
    } else if (isRetrying) {
      return {
        title: `Retrying Failed Components (Attempt ${refreshAttempt + 1}/${maxRetries})`,
        subtitle: "Scout is retrying components that failed to load",
        bgColor: "from-yellow-50 to-orange-50",
        borderColor: "border-yellow-200"
      };
    } else {
      return {
        title: "Scout is Analyzing Market Data...",
        subtitle: "Processing your company profile updates across all components",
        bgColor: "from-blue-50 to-cyan-50",
        borderColor: "border-blue-200"
      };
    }
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl mx-4 w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className={`mb-6 p-4 rounded-lg bg-gradient-to-r ${overallStatus.bgColor} border ${overallStatus.borderColor}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500 text-white rounded-full">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{overallStatus.title}</h2>
          </div>
          <p className="text-sm text-gray-600">{overallStatus.subtitle}</p>
        </div>

        {/* Component Status List */}
        <div className="space-y-3 mb-6">
          {components.map((component) => {
            const Icon = component.icon;
            const displayStatus = getComponentDisplayStatus(component.name);
            const progress = getComponentProgress(component.name);
            const renderingStatus = componentRenderingStatus[component.name];
            
            return (
              <Card key={component.name} className={`border-gray-200 ${displayStatus === 'success' ? 'bg-green-50' : displayStatus === 'failed' ? 'bg-red-50' : 'bg-blue-50'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-gray-600" />
                      <span className="font-medium text-gray-900">{component.name}</span>
                      {loadingPhase === 'rendering' && renderingStatus && (
                        <span className="text-xs text-gray-500">
                          {renderingStatus === 'complete' ? '✅ Rendered' : renderingStatus === 'rendering' ? '🎨 Rendering...' : '⏳ Pending'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusIcon(displayStatus)}
                      {getStatusBadge(displayStatus)}
                    </div>
                  </div>
                  {/* Enhanced progress indicator */}
                  {displayStatus === 'pending' && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            loadingPhase === 'rendering' ? 'bg-purple-600' : 'bg-blue-600'
                          }`} 
                          style={{width: `${progress}%`}}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {loadingPhase === 'api' ? 'API Call in progress...' : 
                         isValidating ? 'Validating data...' : 'Rendering UI...'}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Validation Progress */}
        {isValidating && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <span className="font-medium text-blue-900">Validation Progress</span>
            </div>
            <div className="text-sm text-blue-800">
              <p>Validation Attempt: {validationAttempt}/20</p>
              <p>Consecutive Validations: {consecutiveValidations}/2</p>
              <p>All 5 components must pass validation before loading screen disappears</p>
            </div>
          </div>
        )}

        {/* Progress Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm text-gray-600">
              {(() => {
                if (loadingPhase === 'api') {
                  const apiComplete = Object.values(componentStatus).filter(status => status === 'success').length;
                  return `${apiComplete} / ${components.length} API Calls Complete`;
                } else if (loadingPhase === 'rendering') {
                  const rendered = Object.values(componentRenderingStatus).filter(status => status === 'complete').length;
                  return `${rendered} / ${components.length} Components Rendered`;
                } else {
                  return `${components.length} / ${components.length} Complete`;
                }
              })()}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                loadingPhase === 'rendering' ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'
              }`}
              style={{ 
                width: `${(() => {
                  if (loadingPhase === 'api') {
                    return (Object.values(componentStatus).filter(status => status === 'success').length / components.length) * 50;
                  } else if (loadingPhase === 'rendering') {
                    const apiComplete = Object.values(componentStatus).filter(status => status === 'success').length;
                    const rendered = Object.values(componentRenderingStatus).filter(status => status === 'complete').length;
                    return 50 + ((rendered / components.length) * 50);
                  } else {
                    return 100;
                  }
                })()}%` 
              }}
            />
          </div>
          {loadingPhase === 'rendering' && (
            <div className="text-xs text-gray-500 mt-2">
              Phase 1: API Calls ✅ | Phase 2: UI Rendering 🎨
            </div>
          )}
        </div>

        {/* Retry Information */}
        {isRetrying && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Retry in progress:</strong> Some components failed to load. Scout is automatically retrying failed components.
            </p>
          </div>
        )}

        {/* Success Message */}
        {allSuccessful && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>All set!</strong> All components have loaded successfully. The Scout screen will appear shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
