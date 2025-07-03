
import React from 'react';

interface PieChartData {
  name: string;
  value: number;
  color: string;
}

interface MiniPieChartProps {
  data: PieChartData[];
  title: string;
}

const MiniPieChart: React.FC<MiniPieChartProps> = ({ data, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;

  const createPath = (value: number) => {
    const angle = (value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle += angle;

    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const largeArcFlag = angle > 180 ? 1 : 0;

    const x1 = 50 + 40 * Math.cos(startAngleRad);
    const y1 = 50 + 40 * Math.sin(startAngleRad);
    const x2 = 50 + 40 * Math.cos(endAngleRad);
    const y2 = 50 + 40 * Math.sin(endAngleRad);

    return `M 50,50 L ${x1},${y1} A 40,40 0 ${largeArcFlag},1 ${x2},${y2} z`;
  };

  return (
    <div className="bg-white rounded-lg p-4 border w-full max-w-sm">
      <h4 className="text-sm font-medium text-gray-700 mb-4 text-center">{title}</h4>
      <div className="flex flex-col items-center gap-4">
        <svg width="160" height="160" viewBox="0 0 100 100" className="flex-shrink-0">
          {data.map((item, index) => (
            <path
              key={index}
              d={createPath(item.value)}
              fill={item.color}
              stroke="white"
              strokeWidth="1"
            />
          ))}
        </svg>
        <div className="space-y-2 w-full">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-700">{item.name}</span>
              </div>
              <span className="text-gray-600 font-medium">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MiniPieChart;
