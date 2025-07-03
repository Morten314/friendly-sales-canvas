
import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface DataPoint {
  name: string;
  value: number;
}

interface MiniLineChartProps {
  data: DataPoint[];
  title: string;
  color: string;
}

const MiniLineChart: React.FC<MiniLineChartProps> = ({ data, title, color }) => {
  return (
    <div className="w-full h-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#6B7280' }}
          />
          <YAxis hide />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 4, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MiniLineChart;
