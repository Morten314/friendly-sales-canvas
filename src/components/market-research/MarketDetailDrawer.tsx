
import { 
  Drawer, 
  DrawerClose, 
  DrawerContent, 
  DrawerDescription, 
  DrawerFooter, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, PieChart, Layers, BarChart3, Globe, Edit3, Save, X } from "lucide-react";
import { AIPromptingInterface } from "./AIPromptingInterface";
import { useState, useEffect } from "react";

interface SubMarket {
  name: string;
  size: string;
  growth: string;
}

interface MarketDetails {
  summary: string;
  subMarkets: SubMarket[];
  keyInsights: string[];
  recommendedActions: string[];
}

interface SelectedMarket {
  name: string;
  score: string;
  size: string;
  competition: string;
  barriers: string;
  details: MarketDetails;
}

interface MarketDetailDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedMarket: SelectedMarket | null;
  isAIViewActive: boolean;
}

export const MarketDetailDrawer = ({ 
  isOpen, 
  onOpenChange, 
  selectedMarket,
  isAIViewActive
}: MarketDetailDrawerProps) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editingSubMarketIndex, setEditingSubMarketIndex] = useState<number | null>(null);
  const [editingInsightIndex, setEditingInsightIndex] = useState<number | null>(null);
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null);
  const [marketData, setMarketData] = useState<SelectedMarket | null>(selectedMarket);

  // Update local state when selectedMarket changes
  useEffect(() => {
    setMarketData(selectedMarket);
  }, [selectedMarket]);

  if (!marketData) return null;

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSubMarketEdit = (index: number, field: string, currentValue: string) => {
    setEditingSubMarketIndex(index);
    setEditingField(`submarket-${field}`);
    setEditValue(currentValue);
  };

  const handleInsightEdit = (index: number, currentValue: string) => {
    setEditingInsightIndex(index);
    setEditingField('insight');
    setEditValue(currentValue);
  };

  const handleActionEdit = (index: number, currentValue: string) => {
    setEditingActionIndex(index);
    setEditingField('action');
    setEditValue(currentValue);
  };

  const handleSave = () => {
    if (!editingField || !marketData) return;

    const updatedMarket = { ...marketData };

    switch (editingField) {
      case 'summary':
        updatedMarket.details.summary = editValue;
        break;
      case 'score':
        updatedMarket.score = editValue;
        break;
      case 'size':
        updatedMarket.size = editValue;
        break;
      case 'competition':
        updatedMarket.competition = editValue;
        break;
      case 'barriers':
        updatedMarket.barriers = editValue;
        break;
      case 'submarket-name':
        if (editingSubMarketIndex !== null) {
          updatedMarket.details.subMarkets[editingSubMarketIndex].name = editValue;
        }
        break;
      case 'submarket-size':
        if (editingSubMarketIndex !== null) {
          updatedMarket.details.subMarkets[editingSubMarketIndex].size = editValue;
        }
        break;
      case 'submarket-growth':
        if (editingSubMarketIndex !== null) {
          updatedMarket.details.subMarkets[editingSubMarketIndex].growth = editValue;
        }
        break;
      case 'insight':
        if (editingInsightIndex !== null) {
          updatedMarket.details.keyInsights[editingInsightIndex] = editValue;
        }
        break;
      case 'action':
        if (editingActionIndex !== null) {
          updatedMarket.details.recommendedActions[editingActionIndex] = editValue;
        }
        break;
    }

    setMarketData(updatedMarket);
    handleCancel();
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue("");
    setEditingSubMarketIndex(null);
    setEditingInsightIndex(null);
    setEditingActionIndex(null);
  };

  const EditableField = ({ 
    field, 
    value, 
    onEdit, 
    className = "" 
  }: { 
    field: string; 
    value: string; 
    onEdit: () => void; 
    className?: string;
  }) => (
    <div className={`group relative ${className}`}>
      <span className="block">{value}</span>
      {isAIViewActive && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
          onClick={onEdit}
        >
          <Edit3 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-xl flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" />
            {marketData.name}
          </DrawerTitle>
          <DrawerDescription>
            Market score: <span className="font-medium">{marketData.score}</span> | 
            TAM: <span className="font-medium">{marketData.size}</span>
          </DrawerDescription>
        </DrawerHeader>
        
        <div className={`${isAIViewActive ? 'grid grid-cols-3 gap-4' : ''} overflow-auto`}>
          {/* First Section - Market Details */}
          <div className={`p-6 overflow-auto ${isAIViewActive ? 'border-r' : ''}`}>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-600" /> Market Summary
                </h3>
                <EditableField
                  field="summary"
                  value={marketData.details.summary}
                  onEdit={() => handleEdit('summary', marketData.details.summary)}
                  className="text-gray-700"
                />
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" /> Sub-Markets
                </h3>
                <div className="bg-white rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-4 py-2 text-left">Sub-Market</th>
                        <th className="px-4 py-2 text-left">Size</th>
                        <th className="px-4 py-2 text-left">Growth</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {marketData.details.subMarkets.map((submarket, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2">
                            <EditableField
                              field={`submarket-name-${index}`}
                              value={submarket.name}
                              onEdit={() => handleSubMarketEdit(index, 'name', submarket.name)}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <EditableField
                              field={`submarket-size-${index}`}
                              value={submarket.size}
                              onEdit={() => handleSubMarketEdit(index, 'size', submarket.size)}
                            />
                          </td>
                          <td className="px-4 py-2 text-green-600">
                            <EditableField
                              field={`submarket-growth-${index}`}
                              value={submarket.growth}
                              onEdit={() => handleSubMarketEdit(index, 'growth', submarket.growth)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" /> Key Insights
                  </h3>
                  <ul className="space-y-2">
                    {marketData.details.keyInsights.map((insight, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        <EditableField
                          field={`insight-${index}`}
                          value={insight}
                          onEdit={() => handleInsightEdit(index, insight)}
                          className="text-sm flex-1"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" /> Recommended Actions
                  </h3>
                  <ul className="space-y-2">
                    {marketData.details.recommendedActions.map((action, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="h-5 w-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        <EditableField
                          field={`action-${index}`}
                          value={action}
                          onEdit={() => handleActionEdit(index, action)}
                          className="text-sm flex-1"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {/* Second Section - Editing Area (only shown when AI mode is active and editing) */}
          {isAIViewActive && editingField && (
            <div className="p-6 border-r bg-gray-50">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Edit Field</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    {editingField === 'summary' && 'Market Summary'}
                    {editingField === 'score' && 'Market Score'}
                    {editingField === 'size' && 'Market Size'}
                    {editingField === 'competition' && 'Competition'}
                    {editingField === 'barriers' && 'Barriers'}
                    {editingField?.startsWith('submarket-') && `Sub-Market ${editingField.split('-')[1]}`}
                    {editingField === 'insight' && 'Key Insight'}
                    {editingField === 'action' && 'Recommended Action'}
                  </label>
                  
                  {editingField === 'summary' ? (
                    <Textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={6}
                      className="w-full"
                    />
                  ) : (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full"
                    />
                  )}
                  
                  <div className="flex gap-2">
                    <Button onClick={handleSave} size="sm" className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                    <Button onClick={handleCancel} variant="outline" size="sm">
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Third Section - AI Prompting (only shown when AI mode is active) */}
          {isAIViewActive && (
            <div className="h-[70vh]">
              <AIPromptingInterface marketName={marketData.name} />
            </div>
          )}
        </div>
        
        <DrawerFooter className="border-t">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
            Generate Full Report
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
