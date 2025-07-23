
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
import { PieChart, Edit3, Save, X } from "lucide-react";
import { AIPromptingInterface } from "./AIPromptingInterface";
import { useState, useEffect } from "react";

interface SwotData {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface SwotAnalysisDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  swotData: SwotData;
  isAIViewActive: boolean;
  onUpdateSwot?: (swot: SwotData) => void;
}

export const SwotAnalysisDrawer = ({ 
  isOpen, 
  onOpenChange, 
  swotData,
  isAIViewActive,
  onUpdateSwot
}: SwotAnalysisDrawerProps) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [swotAnalysis, setSwotAnalysis] = useState<SwotData>(swotData);

  useEffect(() => {
    setSwotAnalysis(swotData);
  }, [swotData]);

  const handleEdit = (field: string, index: number, currentValue: string) => {
    setEditingField(field);
    setEditingIndex(index);
    setEditValue(currentValue);
  };

  const handleSave = () => {
    if (!editingField || editingIndex === null) return;

    const updatedSwot = { ...swotAnalysis };
    
    switch (editingField) {
      case 'strengths':
        updatedSwot.strengths[editingIndex] = editValue;
        break;
      case 'weaknesses':
        updatedSwot.weaknesses[editingIndex] = editValue;
        break;
      case 'opportunities':
        updatedSwot.opportunities[editingIndex] = editValue;
        break;
      case 'threats':
        updatedSwot.threats[editingIndex] = editValue;
        break;
    }

    setSwotAnalysis(updatedSwot);
    
    if (onUpdateSwot) {
      onUpdateSwot(updatedSwot);
    }
    
    handleCancel();
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditingIndex(null);
    setEditValue("");
  };

  const EditableItem = ({ 
    field, 
    value, 
    index,
    onEdit,
    icon,
    iconColor
  }: { 
    field: string; 
    value: string; 
    index: number;
    onEdit: () => void; 
    icon: string;
    iconColor: string;
  }) => (
    <li className="text-sm flex items-start gap-2 group">
      <span className={`${iconColor} font-bold`}>{icon}</span>
      <span className="flex-1">{value}</span>
      {isAIViewActive && (
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Edit3 className="h-3 w-3" />
        </Button>
      )}
    </li>
  );

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-xl flex items-center gap-2">
            <PieChart className="h-5 w-5 text-blue-600" />
            SWOT Analysis Details
          </DrawerTitle>
          <DrawerDescription>
            Edit and analyze SWOT data
          </DrawerDescription>
        </DrawerHeader>
        
        <div className={`${isAIViewActive ? 'grid grid-cols-3 gap-4' : ''} overflow-auto`}>
          {/* First Section - SWOT Data */}
          <div className={`p-6 overflow-auto ${isAIViewActive ? 'border-r' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-green-50 rounded-md p-4 border border-green-100">
                <h3 className="text-green-700 font-medium mb-2">Strengths</h3>
                <ul className="space-y-2">
                  {swotAnalysis.strengths.map((strength, index) => (
                    <EditableItem
                      key={index}
                      field="strengths"
                      value={strength}
                      index={index}
                      onEdit={() => handleEdit('strengths', index, strength)}
                      icon="+"
                      iconColor="text-green-600"
                    />
                  ))}
                </ul>
              </div>
              
              <div className="bg-red-50 rounded-md p-4 border border-red-100">
                <h3 className="text-red-700 font-medium mb-2">Weaknesses</h3>
                <ul className="space-y-2">
                  {swotAnalysis.weaknesses.map((weakness, index) => (
                    <EditableItem
                      key={index}
                      field="weaknesses"
                      value={weakness}
                      index={index}
                      onEdit={() => handleEdit('weaknesses', index, weakness)}
                      icon="-"
                      iconColor="text-red-600"
                    />
                  ))}
                </ul>
              </div>
              
              <div className="bg-blue-50 rounded-md p-4 border border-blue-100">
                <h3 className="text-blue-700 font-medium mb-2">Opportunities</h3>
                <ul className="space-y-2">
                  {swotAnalysis.opportunities.map((opportunity, index) => (
                    <EditableItem
                      key={index}
                      field="opportunities"
                      value={opportunity}
                      index={index}
                      onEdit={() => handleEdit('opportunities', index, opportunity)}
                      icon="→"
                      iconColor="text-blue-600"
                    />
                  ))}
                </ul>
              </div>
              
              <div className="bg-amber-50 rounded-md p-4 border border-amber-100">
                <h3 className="text-amber-700 font-medium mb-2">Threats</h3>
                <ul className="space-y-2">
                  {swotAnalysis.threats.map((threat, index) => (
                    <EditableItem
                      key={index}
                      field="threats"
                      value={threat}
                      index={index}
                      onEdit={() => handleEdit('threats', index, threat)}
                      icon="!"
                      iconColor="text-amber-600"
                    />
                  ))}
                </ul>
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
                    {editingField === 'strengths' && 'Strength'}
                    {editingField === 'weaknesses' && 'Weakness'}
                    {editingField === 'opportunities' && 'Opportunity'}
                    {editingField === 'threats' && 'Threat'}
                  </label>
                  
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full"
                    placeholder={`Enter ${editingField?.slice(0, -1)}`}
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
              <AIPromptingInterface marketName="SWOT Analysis" />
            </div>
          )}
        </div>
        
        <DrawerFooter className="border-t">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
            Generate SWOT Report
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
