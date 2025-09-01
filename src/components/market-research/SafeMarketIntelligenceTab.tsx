
import React from 'react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import MarketIntelligenceTab from './MarketIntelligenceTab';
import { MarketIntelligenceTabProps } from './MarketIntelligenceTabProps';

const SafeMarketIntelligenceTab: React.FC<MarketIntelligenceTabProps> = (props) => {
  console.log('🔍 SafeMarketIntelligenceTab - Rendering with props:', {
    isSplitView: props.isSplitView,
    isRefreshing: props.isRefreshing,
    propsKeys: Object.keys(props)
  });

  // Check for problematic objects before rendering
  const checkForObjects = (obj: any, path = '') => {
    if (obj && typeof obj === 'object' && !React.isValidElement(obj) && !Array.isArray(obj)) {
      if (obj.channel || obj.channelMix || obj.trigger || obj.description) {
        console.error('🚨 FOUND PROBLEMATIC OBJECT:', path, obj);
      }
    }
  };

  // Scan props for problematic objects
  Object.entries(props).forEach(([key, value]) => {
    checkForObjects(value, key);
  });

  return (
    <ErrorBoundary 
      fallbackMessage="Error in Market Intelligence section" 
      componentName="MarketIntelligenceTab"
    >
      <MarketIntelligenceTab {...props} />
    </ErrorBoundary>
  );
};

export default SafeMarketIntelligenceTab;
