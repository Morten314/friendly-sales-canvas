
import React from 'react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ViewToggle } from './ViewToggle';

interface SafeViewToggleProps {
  onViewChange: (isAIView: boolean) => void;
}

const SafeViewToggle: React.FC<SafeViewToggleProps> = (props) => {
  console.log('🔍 SafeViewToggle - Rendering with props:', props);

  return (
    <ErrorBoundary 
      fallbackMessage="Error in view toggle component" 
      componentName="ViewToggle"
    >
      <ViewToggle {...props} />
    </ErrorBoundary>
  );
};

export default SafeViewToggle;
