
import React from 'react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ChatWithScout } from './ChatWithScout';

interface SafeChatWithScoutProps {
  fullPage?: boolean;
}

const SafeChatWithScout: React.FC<SafeChatWithScoutProps> = (props) => {
  console.log('🔍 SafeChatWithScout - Rendering with props:', props);

  return (
    <ErrorBoundary 
      fallbackMessage="Error in Scout chat interface" 
      componentName="ChatWithScout"
    >
      <ChatWithScout {...props} />
    </ErrorBoundary>
  );
};

export default SafeChatWithScout;
