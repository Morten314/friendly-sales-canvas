
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
import { ChartLine, Edit3, Save, X } from "lucide-react";
import { AIPromptingInterface } from "./AIPromptingInterface";
import { useState, useEffect } from "react";

interface MarketSegment {
  segment_id: string;
  segment: string;
  size: string;
  growth_potential: string;
  acquisition_cost: string;
  needs_match: string;
}

interface MarketSegmentsDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedSegment: MarketSegment | null;
  isAIViewActive: boolean;
  onUpdateSegment?: (segment: MarketSegment) => void;
}

export const MarketSegmentsDrawer = ({ 
  isOpen, 
  onOpenChange, 
  selectedSegment,
  isAIViewActive,
  onUpdateSegment
}: MarketSegmentsDrawerProps) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [segmentData, setSegmentData] = useState<MarketSegment | null>(null);

  useEffect(() => {
    setSegmentData(selectedSegment);
  }, [selectedSegment]);

  if (!segmentData) return null;

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSave = () => {
    if (!editingField || !segmentData) return;

    const updatedSegment = { ...segmentData };

    switch (editingField) {
      case 'segment':
        updatedSegment.segment = editValue;
        break;
      case 'size':
        updatedSegment.size = editValue;
        break;
      case 'growth_potential':
        updatedSegment.growth_potential = editValue;
        break;
      case 'acquisition_cost':
        updatedSegment.acquisition_cost = editValue;
        break;
      case 'needs_match':
        updatedSegment.needs_match = editValue;
        break;
    }

    setSegmentData(updatedSegment);
    
    if (onUpdateSegment) {
      onUpdateSegment(updatedSegment);
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
            <ChartLine className="h-5 w-5 text-blue-600" />
            Market Segment Details
          </DrawerTitle>
          <DrawerDescription>
            Edit and analyze market segment data
          </DrawerDescription>
        </DrawerHeader>
        
        <div className={`${isAIViewActive ? 'grid grid-cols-3 gap-4' : ''} overflow-auto`}>
          {/* First Section - Segment Data */}
          <div className={`p-6 overflow-auto ${isAIViewActive ? 'border-r' : ''}`}>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Segment Name</h3>
                <EditableField
                  field="segment"
                  value={segmentData.segment}
                  onEdit={() => handleEdit('segment', segmentData.segment)}
                  className="text-lg font-semibold"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Market Size</h3>
                  <EditableField
                    field="size"
                    value={segmentData.size}
                    onEdit={() => handleEdit('size', segmentData.size)}
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Growth Potential</h3>
                  <EditableField
                    field="growth_potential"
                    value={segmentData.growth_potential}
                    onEdit={() => handleEdit('growth_potential', segmentData.growth_potential)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Acquisition Cost</h3>
                  <EditableField
                    field="acquisition_cost"
                    value={segmentData.acquisition_cost}
                    onEdit={() => handleEdit('acquisition_cost', segmentData.acquisition_cost)}
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Needs Match</h3>
                  <EditableField
                    field="needs_match"
                    value={segmentData.needs_match}
                    onEdit={() => handleEdit('needs_match', segmentData.needs_match)}
                  />
                </div>
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
                    {editingField === 'segment' && 'Segment Name'}
                    {editingField === 'size' && 'Market Size'}
                    {editingField === 'growth_potential' && 'Growth Potential'}
                    {editingField === 'acquisition_cost' && 'Acquisition Cost'}
                    {editingField === 'needs_match' && 'Needs Match'}
                  </label>
                  
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full"
                    placeholder={`Enter ${editingField}`}
                  />
                  
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
              <AIPromptingInterface marketName={segmentData.segment} />
            </div>
          )}
        </div>
        
        <DrawerFooter className="border-t">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
            Generate Segment Report
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
