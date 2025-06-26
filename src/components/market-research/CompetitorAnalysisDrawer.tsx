
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
import { BarChart3, Edit3, Save, X } from "lucide-react";
import { useState, useEffect } from "react";

interface Market {
  name: string;
  score: string;
  size: string;
  competition: string;
  barriers: string;
  details: {
    summary: string;
    subMarkets: Array<{
      name: string;
      size: string;
      growth: string;
    }>;
    keyInsights: string[];
    recommendedActions: string[];
  };
}

interface CompetitorAnalysisDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedCompetitor: Market | null;
  isAIViewActive: boolean;
}

export const CompetitorAnalysisDrawer = ({ 
  isOpen, 
  onOpenChange, 
  selectedCompetitor,
  isAIViewActive
}: CompetitorAnalysisDrawerProps) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [competitorData, setCompetitorData] = useState<Market | null>(null);

  useEffect(() => {
    setCompetitorData(selectedCompetitor);
  }, [selectedCompetitor]);

  if (!competitorData) return null;

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSave = () => {
    if (!editingField || !competitorData) return;

    const updatedCompetitor = { ...competitorData };

    switch (editingField) {
      case 'name':
        updatedCompetitor.name = editValue;
        break;
      case 'score':
        updatedCompetitor.score = editValue;
        break;
      case 'size':
        updatedCompetitor.size = editValue;
        break;
      case 'competition':
        updatedCompetitor.competition = editValue;
        break;
      case 'barriers':
        updatedCompetitor.barriers = editValue;
        break;
    }

    setCompetitorData(updatedCompetitor);
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
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Competitor Analysis Details
          </DrawerTitle>
          <DrawerDescription>
            Edit and analyze competitor data
          </DrawerDescription>
        </DrawerHeader>
        
        <div className={`${isAIViewActive && editingField ? 'grid grid-cols-2 gap-4' : ''} overflow-auto`}>
          <div className={`p-6 overflow-auto ${isAIViewActive && editingField ? 'border-r' : ''}`}>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Market Name</h3>
                  <EditableField
                    field="name"
                    value={competitorData.name}
                    onEdit={() => handleEdit('name', competitorData.name)}
                    className="text-lg font-semibold"
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Score</h3>
                  <EditableField
                    field="score"
                    value={competitorData.score}
                    onEdit={() => handleEdit('score', competitorData.score)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Market Size</h3>
                  <EditableField
                    field="size"
                    value={competitorData.size}
                    onEdit={() => handleEdit('size', competitorData.size)}
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Competition</h3>
                  <EditableField
                    field="competition"
                    value={competitorData.competition}
                    onEdit={() => handleEdit('competition', competitorData.competition)}
                  />
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Barriers</h3>
                <EditableField
                  field="barriers"
                  value={competitorData.barriers}
                  onEdit={() => handleEdit('barriers', competitorData.barriers)}
                />
              </div>
            </div>
          </div>
          
          {isAIViewActive && editingField && (
            <div className="p-6 bg-gray-50">
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
                    {editingField === 'name' && 'Market Name'}
                    {editingField === 'score' && 'Score'}
                    {editingField === 'size' && 'Market Size'}
                    {editingField === 'competition' && 'Competition'}
                    {editingField === 'barriers' && 'Barriers'}
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
        </div>
        
        <DrawerFooter className="border-t">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
            Generate Analysis Report
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
