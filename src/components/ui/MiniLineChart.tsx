
import React from 'react';

interface LineChartData {
  name: string;
  value: number;
}

interface MiniLineChartProps {
  data: LineChartData[];
  title: string;
  color?: string;
}

const MiniLineChart: React.FC<MiniLineChartProps> = ({ data, title, color = '#3b82f6' }) => {
  // Handle undefined or empty data
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg p-4 border w-full max-w-sm">
        <h4 className="text-sm font-medium text-gray-700 mb-4 text-center">{title}</h4>
        <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
          No data available
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1; // Prevent division by zero

  const createPath = () => {
    const width = 140;
    const height = 80;
    const padding = 10;
    
    const points = data.map((item, index) => {
      const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((item.value - minValue) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  };

  return (
    <div className="bg-white rounded-lg p-4 border w-full max-w-sm">
      <h4 className="text-sm font-medium text-gray-700 mb-4 text-center">{title}</h4>
      <div className="flex flex-col items-center gap-4">
        <svg width="160" height="100" viewBox="0 0 160 100" className="flex-shrink-0">
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="160" height="100" fill="url(#grid)" />
          
          {/* Line */}
          <path
            d={createPath()}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          
          {/* Data points */}
          {data.map((item, index) => {
            const x = 10 + (index / (data.length - 1)) * 140;
            const y = 90 - ((item.value - minValue) / range) * 70;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="3"
                fill={color}
                stroke="white"
                strokeWidth="2"
              />
            );
          })}
        </svg>
        
        <div className="flex justify-between w-full text-xs text-gray-500">
          <span>{data[0]?.name}</span>
          <span>{data[data.length - 1]?.name}</span>
        </div>
      </div>
    </div>
  );
};

export default MiniLineChart;
