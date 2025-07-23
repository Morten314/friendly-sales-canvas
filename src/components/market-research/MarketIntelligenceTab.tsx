
import React from 'react';
import MarketIntelligenceSections from './MarketIntelligenceSections';
import { MarketIntelligenceTabProps } from './MarketIntelligenceTabProps';

const MarketIntelligenceTab: React.FC<MarketIntelligenceTabProps> = (props) => {
  return (
    <div className={`${props.isSplitView ? 'w-3/5' : 'flex-1'} transition-all duration-500 space-y-6`}>
      <MarketIntelligenceSections {...props} />
    </div>
  );
};

export default MarketIntelligenceTab;
