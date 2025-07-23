
// import React, { useState } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";

// type PipelineStage = {
//   name: string;
//   count: number;
//   conversionRate: number;
//   color: string;
// }

// const pipelineData = {
//   '7': [
//     { name: 'Leads prospected', count: 85, conversionRate: 0, color: 'bg-blue-500' },
//     { name: 'Leads qualified', count: 42, conversionRate: 49, color: 'bg-cyan-500' },
//     { name: 'Soft connect', count: 28, conversionRate: 67, color: 'bg-teal-400' },
//     { name: 'POC connected', count: 18, conversionRate: 64, color: 'bg-green-400' },
//     { name: 'Discovery call', count: 12, conversionRate: 67, color: 'bg-green-500' },
//     { name: 'Demo call', count: 8, conversionRate: 67, color: 'bg-lime-500' },
//   ],
//   '15': [
//     { name: 'Leads prospected', count: 162, conversionRate: 0, color: 'bg-blue-500' },
//     { name: 'Leads qualified', count: 78, conversionRate: 48, color: 'bg-cyan-500' },
//     { name: 'Soft connect', count: 51, conversionRate: 65, color: 'bg-teal-400' },
//     { name: 'POC connected', count: 34, conversionRate: 67, color: 'bg-green-400' },
//     { name: 'Discovery call', count: 24, conversionRate: 71, color: 'bg-green-500' },
//     { name: 'Demo call', count: 18, conversionRate: 75, color: 'bg-lime-500' },
//   ],
//   '30': [
//     { name: 'Leads prospected', count: 320, conversionRate: 0, color: 'bg-blue-500' },
//     { name: 'Leads qualified', count: 155, conversionRate: 48, color: 'bg-cyan-500' },
//     { name: 'Soft connect', count: 98, conversionRate: 63, color: 'bg-teal-400' },
//     { name: 'POC connected', count: 64, conversionRate: 65, color: 'bg-green-400' },
//     { name: 'Discovery call', count: 43, conversionRate: 67, color: 'bg-green-500' },
//     { name: 'Demo call', count: 31, conversionRate: 72, color: 'bg-lime-500' },
//   ],
//   '60': [
//     { name: 'Leads prospected', count: 560, conversionRate: 0, color: 'bg-blue-500' },
//     { name: 'Leads qualified', count: 265, conversionRate: 47, color: 'bg-cyan-500' },
//     { name: 'Soft connect', count: 175, conversionRate: 66, color: 'bg-teal-400' },
//     { name: 'POC connected', count: 110, conversionRate: 63, color: 'bg-green-400' },
//     { name: 'Discovery call', count: 78, conversionRate: 71, color: 'bg-green-500' },
//     { name: 'Demo call', count: 52, conversionRate: 67, color: 'bg-lime-500' },
//   ],
// };

// export function PipelineSnapshot() {
//   const [timeframe, setTimeframe] = useState('7');
  
//   const handleTimeframeChange = (value: string) => {
//     setTimeframe(value);
//   };

//   const currentData = pipelineData[timeframe as keyof typeof pipelineData];

//   return (
//     <Card className="mb-6">
//       <CardHeader className="pb-0">
//         <div className="flex items-center justify-between">
//           <CardTitle className="text-lg">Pipeline at a Glance</CardTitle>
//           <Select value={timeframe} onValueChange={handleTimeframeChange}>
//             <SelectTrigger className="w-[120px] h-8 text-xs">
//               <SelectValue placeholder="7 days" />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="7">7 days</SelectItem>
//               <SelectItem value="15">15 days</SelectItem>
//               <SelectItem value="30">30 days</SelectItem>
//               <SelectItem value="60">60 days</SelectItem>
//             </SelectContent>
//           </Select>
//         </div>
//       </CardHeader>
//       <CardContent className="pt-4">
//         <div className="flex items-end h-[180px] gap-2 mb-4">
//           {currentData.map((stage, index) => (
//             <div key={index} className="flex-1 flex flex-col items-center">
//               <div 
//                 className={`w-full ${stage.color} rounded-t-md`} 
//                 style={{ height: `${(stage.count / currentData[0].count) * 150}px` }}
//               ></div>
//               <div className="text-xs mt-1 text-center">{stage.count}</div>
//             </div>
//           ))}
//         </div>
//         <div className="flex gap-2 justify-between">
//           {currentData.map((stage, index) => (
//             <div key={index} className="flex-1">
//               <div className="text-[10px] text-center font-medium whitespace-nowrap overflow-hidden text-ellipsis">
//                 {stage.name}
//                 {stage.conversionRate > 0 && (
//                   <div className="text-[9px] text-blue-600">
//                     {stage.conversionRate}%
//                   </div>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       </CardContent>
//     </Card>
//   );
// }


import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PipelineStage = {
  name: string;
  count: number;
  conversionRate: number;
  color: string;
}

type ApiTimeframe = {
  days: number;
  stages: {
    name: string;
    count: number;
    conversionRate: number;
  }[];
}

type ApiResponse = {
  timeframes: ApiTimeframe[];
}

const stageColors = [
  'bg-blue-500',
  'bg-cyan-500', 
  'bg-teal-400',
  'bg-green-400',
  'bg-green-500',
  'bg-lime-500'
];

// Fallback data in case API fails
const fallbackData: { [key: string]: PipelineStage[] } = {
  '7': [
    { name: 'Leads prospected', count: 85, conversionRate: 0, color: 'bg-blue-500' },
    { name: 'Leads qualified', count: 42, conversionRate: 49, color: 'bg-cyan-500' },
    { name: 'Soft connect', count: 28, conversionRate: 67, color: 'bg-teal-400' },
    { name: 'POC connected', count: 18, conversionRate: 64, color: 'bg-green-400' },
    { name: 'Discovery call', count: 12, conversionRate: 67, color: 'bg-green-500' },
    { name: 'Demo call', count: 8, conversionRate: 67, color: 'bg-lime-500' },
  ],
  '15': [
    { name: 'Leads prospected', count: 162, conversionRate: 0, color: 'bg-blue-500' },
    { name: 'Leads qualified', count: 78, conversionRate: 48, color: 'bg-cyan-500' },
    { name: 'Soft connect', count: 51, conversionRate: 65, color: 'bg-teal-400' },
    { name: 'POC connected', count: 34, conversionRate: 67, color: 'bg-green-400' },
    { name: 'Discovery call', count: 24, conversionRate: 71, color: 'bg-green-500' },
    { name: 'Demo call', count: 18, conversionRate: 75, color: 'bg-lime-500' },
  ],
  '30': [
    { name: 'Leads prospected', count: 320, conversionRate: 0, color: 'bg-blue-500' },
    { name: 'Leads qualified', count: 155, conversionRate: 48, color: 'bg-cyan-500' },
    { name: 'Soft connect', count: 98, conversionRate: 63, color: 'bg-teal-400' },
    { name: 'POC connected', count: 64, conversionRate: 65, color: 'bg-green-400' },
    { name: 'Discovery call', count: 43, conversionRate: 67, color: 'bg-green-500' },
    { name: 'Demo call', count: 31, conversionRate: 72, color: 'bg-lime-500' },
  ],
  '60': [
    { name: 'Leads prospected', count: 560, conversionRate: 0, color: 'bg-blue-500' },
    { name: 'Leads qualified', count: 265, conversionRate: 47, color: 'bg-cyan-500' },
    { name: 'Soft connect', count: 175, conversionRate: 66, color: 'bg-teal-400' },
    { name: 'POC connected', count: 110, conversionRate: 63, color: 'bg-green-400' },
    { name: 'Discovery call', count: 78, conversionRate: 71, color: 'bg-green-500' },
    { name: 'Demo call', count: 52, conversionRate: 67, color: 'bg-lime-500' },
  ],
};

interface PipelineSnapshotProps {
  userId?: string;
}

export function PipelineSnapshot({ userId = 'brewra' }: PipelineSnapshotProps) {
  const [timeframe, setTimeframe] = useState('7');
  const [pipelineData, setPipelineData] = useState<PipelineStage[]>([]);
  const [availableTimeframes, setAvailableTimeframes] = useState<string[]>(['7', '15', '30', '60']); // Default to common timeframes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const processApiData = (apiData: ApiResponse, selectedTimeframe: string): PipelineStage[] => {
    console.log('🔄 Processing API data:', apiData);
    
    // Find the timeframe data that matches the selected timeframe
    const timeframeData = apiData.timeframes.find(tf => tf.days.toString() === selectedTimeframe);
    
    if (!timeframeData) {
      console.warn(`⚠️ No data found for ${selectedTimeframe} days timeframe`);
      throw new Error(`No data available for ${selectedTimeframe} days`);
    }
    
    console.log('📊 Found timeframe data:', timeframeData);
    
    // Convert API format to component format
    const formattedData: PipelineStage[] = timeframeData.stages.map((stage, index) => ({
      name: stage.name,
      count: stage.count,
      // Convert decimal to percentage (0.8 -> 80%)
      conversionRate: Math.round(stage.conversionRate * 100),
      color: stageColors[index] || 'bg-gray-400'
    }));
    
    console.log('✅ Formatted data:', formattedData);
    return formattedData;
  };

  const extractAvailableTimeframes = (apiData: ApiResponse): string[] => {
    return apiData.timeframes.map(tf => tf.days.toString()).sort((a, b) => parseInt(a) - parseInt(b));
  };

  const fetchSingleTimeframeData = async (timeframeDays: string) => {
    const params = new URLSearchParams({
      user_id: userId,
      timeframe: timeframeDays
    });
    
    const url = `https://backend-11kr.onrender.com/Sales_Pipeline?${params.toString()}`;
    
    console.log(`🔍 Fetching data for ${timeframeDays} days:`, url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${timeframeDays} days`);
    }
    
    const data = await response.json();
    console.log(`📊 Response for ${timeframeDays} days:`, data);
    
    return data;
  };

  const fetchPipelineData = async (selectedTimeframe: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 API Call Details:');
      console.log('User ID:', userId);
      console.log('Selected Timeframe:', selectedTimeframe);
      
      // First, try to fetch data for the selected timeframe
      let selectedData;
      try {
        selectedData = await fetchSingleTimeframeData(selectedTimeframe);
      } catch (err) {
        console.warn(`⚠️ Failed to fetch ${selectedTimeframe} days data:`, err);
        throw err;
      }
      
      // Try to discover available timeframes by testing common ones
      const commonTimeframes = ['7', '15', '30', '60'];
      const availableData: { [key: string]: any } = {};
      const workingTimeframes: string[] = [];
      
      for (const timeframe of commonTimeframes) {
        try {
          const data = await fetchSingleTimeframeData(timeframe);
          availableData[timeframe] = data;
          workingTimeframes.push(timeframe);
          console.log(`✅ ${timeframe} days data available`);
        } catch (err) {
          console.warn(`⚠️ ${timeframe} days data not available:`, err);
        }
      }
      
      console.log('📊 Available timeframes:', workingTimeframes);
      setAvailableTimeframes(workingTimeframes);
      
      // Use the selected timeframe data if available, otherwise use the first available
      const dataToProcess = availableData[selectedTimeframe] || selectedData;
      
      // Process the API response based on its structure
      let formattedData: PipelineStage[];
      
      if (dataToProcess.timeframes && Array.isArray(dataToProcess.timeframes)) {
        // New format: { timeframes: [{ days: X, stages: [...] }] }
        const timeframeData = dataToProcess.timeframes.find((tf: any) => tf.days.toString() === selectedTimeframe);
        if (!timeframeData) {
          throw new Error(`No data found for ${selectedTimeframe} days`);
        }
        
        formattedData = timeframeData.stages.map((stage: any, index: number) => ({
          name: stage.name,
          count: stage.count,
          conversionRate: Math.round(stage.conversionRate * 100),
          color: stageColors[index] || 'bg-gray-400'
        }));
      } else if (dataToProcess.stages && Array.isArray(dataToProcess.stages)) {
        // Alternative format: { stages: [...] }
        formattedData = dataToProcess.stages.map((stage: any, index: number) => ({
          name: stage.name,
          count: stage.count,
          conversionRate: Math.round(stage.conversionRate * 100),
          color: stageColors[index] || 'bg-gray-400'
        }));
      } else if (Array.isArray(dataToProcess)) {
        // Direct array format: [{ name, count, conversionRate }]
        formattedData = dataToProcess.map((stage: any, index: number) => ({
          name: stage.name,
          count: stage.count,
          conversionRate: Math.round(stage.conversionRate * 100),
          color: stageColors[index] || 'bg-gray-400'
        }));
      } else {
        console.error('❌ Unexpected API response format:', dataToProcess);
        throw new Error('Unexpected API response format');
      }
      
      console.log('✅ Successfully processed API data:', formattedData);
      setPipelineData(formattedData);
      setIsUsingFallback(false);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('❌ API Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pipeline data');
      
      // Use fallback data if API fails
      const fallbackTimeframeData = fallbackData[selectedTimeframe];
      if (fallbackTimeframeData) {
        console.log('🔄 Using fallback data for timeframe:', selectedTimeframe);
        setPipelineData(fallbackTimeframeData);
        setIsUsingFallback(true);
        setError(null); // Clear error since we have fallback data
        // Set fallback timeframes
        setAvailableTimeframes(['7', '15', '30', '60']);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelineData(timeframe);
  }, [timeframe, userId]);

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value);
  };

  const maxCount = pipelineData.length > 0 ? Math.max(...pipelineData.map(stage => stage.count)) : 1;

  if (error && !isUsingFallback) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg text-red-600">Pipeline at a Glance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-2">Error loading pipeline data</p>
            <p className="text-sm text-gray-500">{error}</p>
            <button 
              onClick={() => fetchPipelineData(timeframe)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Pipeline at a Glance</CardTitle>
            {isUsingFallback && (
              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                Demo Data
              </span>
            )}
            {!isUsingFallback && lastUpdated && (
              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full border border-green-200">
                Live Data
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && !isUsingFallback && (
              <span className="text-xs text-gray-500">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button 
              onClick={() => fetchPipelineData(timeframe)}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              title="Refresh data"
              disabled={loading}
            >
              {loading ? '⏳' : '🔄'} Refresh
            </button>
            <button 
              onClick={() => {
                console.log('🔍 Debug Info:');
                console.log('Current timeframe:', timeframe);
                console.log('Available timeframes:', availableTimeframes);
                console.log('Current data:', pipelineData);
                console.log('Is using fallback:', isUsingFallback);
                console.log('Last updated:', lastUpdated);
              }}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              title="Debug info"
            >
              🐛 Debug
            </button>
            <Select value={timeframe} onValueChange={handleTimeframeChange}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="7 days" />
              </SelectTrigger>
              <SelectContent>
                {availableTimeframes.map(days => (
                  <SelectItem key={days} value={days}>
                    {days} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center h-[180px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : pipelineData.length === 0 ? (
          <div className="flex items-center justify-center h-[180px]">
            <p className="text-gray-500">No pipeline data available</p>
          </div>
        ) : (
          <>
            <div className="flex items-end h-[180px] gap-2 mb-4">
              {pipelineData.map((stage, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className={`w-full ${stage.color} rounded-t-md transition-all duration-300`} 
                    style={{ height: `${(stage.count / maxCount) * 150}px` }}
                  ></div>
                  <div className="text-xs mt-1 text-center font-medium">{stage.count}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-between">
              {pipelineData.map((stage, index) => (
                <div key={index} className="flex-1">
                  <div className="text-[10px] text-center font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {stage.name}
                    {stage.conversionRate > 0 && (
                      <div className="text-[9px] text-blue-600">
                        {stage.conversionRate}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}