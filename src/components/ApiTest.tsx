import React, { useState } from 'react';
import { apiFetchJson } from '@/lib/api';

const ApiTest: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testApiCall = async () => {
    setLoading(true);
    setResult('Testing API call...');
    
    try {
      const payload = {
        user_id: "test",
        component_name: "industry trends report",
        data: {
          additionalPrompt: {
            industry: "manufacturing",
            companySize: "51-200",
            targetMarkets: ["US"],
            strategicGoals: "Test goal"
          }
        },
        refresh: true
      };

      console.log('🧪 Testing API call with payload:', payload);
      
      const response = await apiFetchJson('market-research', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      console.log('🧪 API Response:', response);
      setResult(`✅ Success! Status: ${response.status}, Data received: ${!!response.data}`);
      
    } catch (error) {
      console.error('🧪 API Test Error:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">API Endpoint Test</h3>
      <button 
        onClick={testApiCall}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test API Call'}
      </button>
      <div className="mt-4 p-3 bg-white border rounded">
        <pre className="text-sm">{result}</pre>
      </div>
    </div>
  );
};

export default ApiTest;
