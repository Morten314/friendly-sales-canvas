
import React from 'react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ChatWithScout } from './ChatWithScout';

interface SafeChatWithScoutProps {
  fullPage?: boolean;
  researchContext?: { leads: { name: string; company: string; jobTitle: string; email?: string; tenure?: string; source?: string; signals?: string[] }[]; opportunity?: string; icp?: string } | null;
}

const SafeChatWithScout: React.FC<SafeChatWithScoutProps> = (props) => {
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
