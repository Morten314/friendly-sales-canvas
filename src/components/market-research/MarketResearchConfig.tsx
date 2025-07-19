import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Settings } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export interface MarketResearchConfigData {
  industry: string;
  target_region: string;
  year_range: {
    start: number;
    end: number;
  };
  segments: string[];
  distribution_channels: string[];
  key_competitors: string[];
}

interface MarketResearchConfigProps {
  config: MarketResearchConfigData;
  onConfigChange: (config: MarketResearchConfigData) => void;
  trigger?: React.ReactNode;
}

const MarketResearchConfig: React.FC<MarketResearchConfigProps> = ({ 
  config, 
  onConfigChange,
  trigger 
}) => {
  const [localConfig, setLocalConfig] = useState<MarketResearchConfigData>(config);
  const [newSegment, setNewSegment] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = () => {
    onConfigChange(localConfig);
    setIsOpen(false);
  };

  const addArrayItem = (field: 'segments' | 'distribution_channels' | 'key_competitors', value: string) => {
    if (value.trim()) {
      setLocalConfig(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
      
      // Clear the input based on field
      if (field === 'segments') setNewSegment('');
      if (field === 'distribution_channels') setNewChannel('');
      if (field === 'key_competitors') setNewCompetitor('');
    }
  };

  const removeArrayItem = (field: 'segments' | 'distribution_channels' | 'key_competitors', index: number) => {
    setLocalConfig(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Settings className="h-4 w-4 mr-2" />
      Configure Research
    </Button>
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent className="w-[600px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Market Research Configuration</SheetTitle>
          <SheetDescription>
            Configure the parameters for your market research analysis
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={localConfig.industry}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, industry: e.target.value }))}
                  placeholder="e.g., Baby Food, SaaS, Automotive"
                />
              </div>
              
              <div>
                <Label htmlFor="target_region">Target Region</Label>
                <Input
                  id="target_region"
                  value={localConfig.target_region}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, target_region: e.target.value }))}
                  placeholder="e.g., North America, Europe, Asia Pacific"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_year">Start Year</Label>
                  <Input
                    id="start_year"
                    type="number"
                    value={localConfig.year_range.start}
                    onChange={(e) => setLocalConfig(prev => ({ 
                      ...prev, 
                      year_range: { ...prev.year_range, start: parseInt(e.target.value) || 2020 }
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="end_year">End Year</Label>
                  <Input
                    id="end_year"
                    type="number"
                    value={localConfig.year_range.end}
                    onChange={(e) => setLocalConfig(prev => ({ 
                      ...prev, 
                      year_range: { ...prev.year_range, end: parseInt(e.target.value) || 2025 }
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Market Segments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Market Segments</CardTitle>
              <CardDescription>Define the market segments you want to analyze</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newSegment}
                  onChange={(e) => setNewSegment(e.target.value)}
                  placeholder="Add market segment"
                  onKeyPress={(e) => e.key === 'Enter' && addArrayItem('segments', newSegment)}
                />
                <Button 
                  type="button" 
                  size="sm"
                  onClick={() => addArrayItem('segments', newSegment)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {localConfig.segments.map((segment, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1">
                    {segment}
                    <button
                      onClick={() => removeArrayItem('segments', index)}
                      className="ml-2 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Distribution Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribution Channels</CardTitle>
              <CardDescription>Specify the distribution channels to analyze</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  placeholder="Add distribution channel"
                  onKeyPress={(e) => e.key === 'Enter' && addArrayItem('distribution_channels', newChannel)}
                />
                <Button 
                  type="button" 
                  size="sm"
                  onClick={() => addArrayItem('distribution_channels', newChannel)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {localConfig.distribution_channels.map((channel, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1">
                    {channel}
                    <button
                      onClick={() => removeArrayItem('distribution_channels', index)}
                      className="ml-2 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Key Competitors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Competitors</CardTitle>
              <CardDescription>List the main competitors in your market</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  placeholder="Add competitor"
                  onKeyPress={(e) => e.key === 'Enter' && addArrayItem('key_competitors', newCompetitor)}
                />
                <Button 
                  type="button" 
                  size="sm"
                  onClick={() => addArrayItem('key_competitors', newCompetitor)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {localConfig.key_competitors.map((competitor, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1">
                    {competitor}
                    <button
                      onClick={() => removeArrayItem('key_competitors', index)}
                      className="ml-2 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Configuration
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MarketResearchConfig;