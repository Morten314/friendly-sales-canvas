
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
import { TrendingUp, Edit3, Save, X } from "lucide-react";
import { AIPromptingInterface } from "./AIPromptingInterface";
import { useState, useEffect } from "react";

interface EmergingTrend {
  trend: string;
  growthRate: string;
  adoption: string;
  impact: string;
  description: string;
}

interface EmergingTrendsDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedTrend: EmergingTrend | null;
  isAIViewActive: boolean;
  onUpdateTrend?: (trend: EmergingTrend) => void;
}

export const EmergingTrendsDrawer = ({ 
  isOpen, 
  onOpenChange, 
  selectedTrend,
  isAIViewActive,
  onUpdateTrend
}: EmergingTrendsDrawerProps) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [trendData, setTrendData] = useState<EmergingTrend | null>(null);

  useEffect(() => {
    setTrendData(selectedTrend);
  }, [selectedTrend]);

  if (!trendData) return null;

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSave = () => {
    if (!editingField || !trendData) return;

    const updatedTrend = { ...trendData };

    switch (editingField) {
      case 'trend':
        updatedTrend.trend = editValue;
        break;
      case 'growthRate':
        updatedTrend.growthRate = editValue;
        break;
      case 'adoption':
        updatedTrend.adoption = editValue;
        break;
      case 'impact':
        updatedTrend.impact = editValue;
        break;
      case 'description':
        updatedTrend.description = editValue;
        break;
    }

    setTrendData(updatedTrend);
    
    if (onUpdateTrend) {
      onUpdateTrend(updatedTrend);
    }
    
    handleCancel();
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue("");
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
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
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
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Emerging Trend Details
          </DrawerTitle>
          <DrawerDescription>
            Edit and analyze emerging trend data
          </DrawerDescription>
        </DrawerHeader>
        
        <div className={`${isAIViewActive ? 'grid grid-cols-3 gap-4' : ''} overflow-auto`}>
          {/* First Section - Trend Data */}
          <div className={`p-6 overflow-auto ${isAIViewActive ? 'border-r' : ''}`}>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Trend Name</h3>
                <EditableField
                  field="trend"
                  value={trendData.trend}
                  onEdit={() => handleEdit('trend', trendData.trend)}
                  className="text-lg font-semibold text-blue-700"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Growth Rate</h3>
                  <EditableField
                    field="growthRate"
                    value={trendData.growthRate}
                    onEdit={() => handleEdit('growthRate', trendData.growthRate)}
                    className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full inline-block"
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Adoption</h3>
                  <EditableField
                    field="adoption"
                    value={trendData.adoption}
                    onEdit={() => handleEdit('adoption', trendData.adoption)}
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Impact</h3>
                  <EditableField
                    field="impact"
                    value={trendData.impact}
                    onEdit={() => handleEdit('impact', trendData.impact)}
                  />
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                <EditableField
                  field="description"
                  value={trendData.description}
                  onEdit={() => handleEdit('description', trendData.description)}
                  className="text-gray-600"
                />
              </div>
            </div>
          </div>
          
          {/* Second Section - Editing Area */}
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
                    {editingField === 'trend' && 'Trend Name'}
                    {editingField === 'growthRate' && 'Growth Rate'}
                    {editingField === 'adoption' && 'Adoption Level'}
                    {editingField === 'impact' && 'Impact Level'}
                    {editingField === 'description' && 'Description'}
                  </label>
                  
                  {editingField === 'description' ? (
                    <Textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={4}
                      className="w-full"
                    />
                  ) : (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full"
                      placeholder={`Enter ${editingField}`}
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
          
          {/* Third Section - AI Prompting */}
          {isAIViewActive && (
            <div className="h-[70vh]">
              <AIPromptingInterface marketName={trendData.trend} />
            </div>
          )}
        </div>
        
        <DrawerFooter className="border-t">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
            Generate Trend Report
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
