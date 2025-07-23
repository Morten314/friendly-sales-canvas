
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
import { Layers, Edit3, Save, X } from "lucide-react";
import { AIPromptingInterface } from "./AIPromptingInterface";
import { useState, useEffect } from "react";

interface TechnologyDriver {
  technology: string;
  maturity: string;
  relevance: string;
  timeToAdopt: string;
}

interface TechnologyDriversDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedTechnology: TechnologyDriver | null;
  isAIViewActive: boolean;
  onUpdateTechnology?: (technology: TechnologyDriver) => void;
}

export const TechnologyDriversDrawer = ({ 
  isOpen, 
  onOpenChange, 
  selectedTechnology,
  isAIViewActive,
  onUpdateTechnology
}: TechnologyDriversDrawerProps) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [technologyData, setTechnologyData] = useState<TechnologyDriver | null>(null);

  useEffect(() => {
    setTechnologyData(selectedTechnology);
  }, [selectedTechnology]);

  if (!technologyData) return null;

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSave = () => {
    if (!editingField || !technologyData) return;

    const updatedTechnology = { ...technologyData };

    switch (editingField) {
      case 'technology':
        updatedTechnology.technology = editValue;
        break;
      case 'maturity':
        updatedTechnology.maturity = editValue;
        break;
      case 'relevance':
        updatedTechnology.relevance = editValue;
        break;
      case 'timeToAdopt':
        updatedTechnology.timeToAdopt = editValue;
        break;
    }

    setTechnologyData(updatedTechnology);
    
    if (onUpdateTechnology) {
      onUpdateTechnology(updatedTechnology);
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
            <Layers className="h-5 w-5 text-blue-600" />
            Technology Driver Details
          </DrawerTitle>
          <DrawerDescription>
            Edit and analyze technology driver data
          </DrawerDescription>
        </DrawerHeader>
        
        <div className={`${isAIViewActive ? 'grid grid-cols-3 gap-4' : ''} overflow-auto`}>
          {/* First Section - Technology Data */}
          <div className={`p-6 overflow-auto ${isAIViewActive ? 'border-r' : ''}`}>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Technology Name</h3>
                <EditableField
                  field="technology"
                  value={technologyData.technology}
                  onEdit={() => handleEdit('technology', technologyData.technology)}
                  className="text-lg font-semibold"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Maturity Level</h3>
                  <EditableField
                    field="maturity"
                    value={technologyData.maturity}
                    onEdit={() => handleEdit('maturity', technologyData.maturity)}
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Business Relevance</h3>
                  <EditableField
                    field="relevance"
                    value={technologyData.relevance}
                    onEdit={() => handleEdit('relevance', technologyData.relevance)}
                  />
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Time to Adopt</h3>
                <EditableField
                  field="timeToAdopt"
                  value={technologyData.timeToAdopt}
                  onEdit={() => handleEdit('timeToAdopt', technologyData.timeToAdopt)}
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
                    {editingField === 'technology' && 'Technology Name'}
                    {editingField === 'maturity' && 'Maturity Level'}
                    {editingField === 'relevance' && 'Business Relevance'}
                    {editingField === 'timeToAdopt' && 'Time to Adopt'}
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
              <AIPromptingInterface marketName={technologyData.technology} />
            </div>
          )}
        </div>
        
        <DrawerFooter className="border-t">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
            Generate Technology Report
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
