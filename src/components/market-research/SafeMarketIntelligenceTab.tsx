
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
      // Check for targetMarkets object that might be rendered directly
      if (obj['North America'] || obj['Europe'] || obj['Asia Pacific'] || obj['Latin America']) {
        console.error('🚨 FOUND TARGET MARKETS OBJECT:', path, obj);
        console.error('🚨 This object should be an array, not an object with region keys');
      }
    }
  };

  // Scan props for problematic objects
  Object.entries(props).forEach(([key, value]) => {
    checkForObjects(value, key);
  });

  // Fix targetMarkets if it's an object instead of array
  const fixedProps = { ...props };
  if (fixedProps.companyProfile?.targetMarkets && 
      typeof fixedProps.companyProfile.targetMarkets === 'object' && 
      !Array.isArray(fixedProps.companyProfile.targetMarkets)) {
    console.warn('🔧 FIXING targetMarkets: Converting object to array');
    fixedProps.companyProfile.targetMarkets = Object.keys(fixedProps.companyProfile.targetMarkets);
  }

  // Additional safety check: Ensure no objects are being passed that could be rendered directly
  const sanitizeProps = (obj: any): any => {
    if (obj && typeof obj === 'object' && !React.isValidElement(obj) && !Array.isArray(obj)) {
      // If it's an object with region keys, convert to array
      if (obj['North America'] || obj['Europe'] || obj['Asia Pacific'] || obj['Latin America']) {
        console.warn('🔧 SANITIZING: Converting region object to array');
        return Object.keys(obj);
      }
      // If it's an object that might be rendered, convert to string representation
      if (obj.channel || obj.channelMix || obj.trigger || obj.description) {
        console.warn('🔧 SANITIZING: Converting problematic object to string');
        return JSON.stringify(obj);
      }
    }
    return obj;
  };

  // Preserve function props before sanitization
  const functionProps: Record<string, any> = {};
  Object.entries(fixedProps).forEach(([key, value]) => {
    if (typeof value === 'function') {
      functionProps[key] = value;
    }
  });

  // Recursively sanitize props to prevent object rendering, but preserve Set objects
  const sanitizedProps = JSON.parse(JSON.stringify(fixedProps, (key, value) => {
    // Preserve Set objects by converting them to arrays during serialization
    if (value instanceof Set) {
      return Array.from(value);
    }
    return sanitizeProps(value);
  }));

  // Restore function props after sanitization
  Object.entries(functionProps).forEach(([key, value]) => {
    sanitizedProps[key] = value;
  });

  // Convert arrays back to Sets for deletedSections properties
  const deletedSectionsKeys = [
    'marketSizeDeletedSections',
    'competitorDeletedSections', 
    'regulatoryDeletedSections',
    'marketEntryDeletedSections'
  ];
  
  deletedSectionsKeys.forEach(key => {
    if (sanitizedProps[key] && Array.isArray(sanitizedProps[key])) {
      console.warn(`🔧 CONVERTING ${key} from array back to Set`);
      sanitizedProps[key] = new Set(sanitizedProps[key]);
    } else if (sanitizedProps[key] && typeof sanitizedProps[key] === 'object' && !(sanitizedProps[key] instanceof Set)) {
      console.warn(`🔧 CONVERTING ${key} from object to Set`);
      sanitizedProps[key] = new Set(Object.keys(sanitizedProps[key]));
    } else if (!sanitizedProps[key]) {
      console.warn(`🔧 CREATING empty Set for ${key}`);
      sanitizedProps[key] = new Set();
    }
  });

  return (
    <ErrorBoundary 
      fallbackMessage="Error in Market Intelligence section" 
      componentName="MarketIntelligenceTab"
    >
      <MarketIntelligenceTab {...sanitizedProps} />
    </ErrorBoundary>
  );
};

export default SafeMarketIntelligenceTab;
