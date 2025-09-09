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
}

export const ComponentStatusLoadingScreen: React.FC<ComponentStatusLoadingScreenProps> = ({
  componentStatus,
  refreshAttempt,
  maxRetries
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
    if (allSuccessful) {
      return {
        title: "All Components Loaded Successfully! 🎉",
        subtitle: "Scout is ready with fresh market intelligence data",
        bgColor: "from-green-50 to-emerald-50",
        borderColor: "border-green-200"
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
            return (
              <Card key={component.name} className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-gray-600" />
                      <span className="font-medium text-gray-900">{component.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusIcon(component.status)}
                      {getStatusBadge(component.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Progress Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm text-gray-600">
              {Object.values(componentStatus).filter(status => status === 'success').length} / {components.length} Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-500"
              style={{ 
                width: `${(Object.values(componentStatus).filter(status => status === 'success').length / components.length) * 100}%` 
              }}
            />
          </div>
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
