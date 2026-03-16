
import React from 'react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import MarketIntelligenceTab from './MarketIntelligenceTab';
import { MarketIntelligenceTabProps } from './MarketIntelligenceTabProps';

const SafeMarketIntelligenceTab: React.FC<MarketIntelligenceTabProps> = (props) => {

  // Check for problematic objects before rendering
  const checkForObjects = (obj: any, path = '') => {
    // Skip regionalHotspots - it's correctly an object from backend with region keys
    if (path === 'industryTrendsRegionalHotspots') {
      return; // This is expected to be an object, don't flag it
    }
    
    if (obj && typeof obj === 'object' && !React.isValidElement(obj) && !Array.isArray(obj)) {
      if (obj.channel || obj.channelMix || obj.trigger || obj.description) {
        console.error('🚨 FOUND PROBLEMATIC OBJECT:', path, obj);
      }
      // Check for targetMarkets object that might be rendered directly
      if (obj['North America'] || obj['Europe'] || obj['Asia Pacific'] || obj['Latin America'] || 
          obj['US'] || obj['Canada'] || obj['Australia']) {
        // Only flag if it's not regionalHotspots (which we already skipped above)
        if (path !== 'industryTrendsRegionalHotspots') {
          console.error('🚨 FOUND TARGET MARKETS OBJECT:', path, obj);
          console.error('🚨 This object should be an array, not an object with region keys');
        }
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
    fixedProps.companyProfile.targetMarkets = Object.keys(fixedProps.companyProfile.targetMarkets);
  }

  // Additional safety check: Ensure no objects are being passed that could be rendered directly
  const sanitizeProps = (obj: any, key?: string): any => {
    if (obj && typeof obj === 'object' && !React.isValidElement(obj) && !Array.isArray(obj)) {
      // Preserve regionalHotspots as it's correctly an object from backend
      if (key === 'industryTrendsRegionalHotspots') {
        return obj; // Keep as-is, it's meant to be an object
      }
      // If it's an object with region keys, convert to array (but not regionalHotspots)
      if (obj['North America'] || obj['Europe'] || obj['Asia Pacific'] || obj['Latin America']) {
        return Object.keys(obj);
      }
      // If it's an object that might be rendered, convert to string representation
      if (obj.channel || obj.channelMix || obj.trigger || obj.description) {
        // Sanitizing: Converting problematic object to string
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
    // Preserve regionalHotspots as object (it's correctly structured from backend)
    if (key === 'industryTrendsRegionalHotspots') {
      return value; // Keep as-is
    }
    return sanitizeProps(value, key);
  }));

  // Restore function props after sanitization
  Object.entries(functionProps).forEach(([key, value]) => {
    sanitizedProps[key] = value;
  });

  // Convert arrays back to Sets for deletedSections properties
  const deletedSectionsKeys = [
    'deletedSections',
    'marketSizeDeletedSections',
    'industryTrendsDeletedSections',
    'competitorDeletedSections', 
    'regulatoryDeletedSections',
    'marketEntryDeletedSections'
  ];
  
  deletedSectionsKeys.forEach(key => {
    if (sanitizedProps[key] && Array.isArray(sanitizedProps[key])) {
      // Converting array back to Set
      sanitizedProps[key] = new Set(sanitizedProps[key]);
    } else if (sanitizedProps[key] && typeof sanitizedProps[key] === 'object' && !(sanitizedProps[key] instanceof Set)) {
        // Converting object to Set
      sanitizedProps[key] = new Set(Object.keys(sanitizedProps[key]));
    } else if (!sanitizedProps[key]) {
      // Creating empty Set
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
