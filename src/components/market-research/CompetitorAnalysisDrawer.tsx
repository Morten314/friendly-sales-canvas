
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
import { BarChart3, Edit3, Save, X } from "lucide-react";
import { AIPromptingInterface } from "./AIPromptingInterface";
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
  onUpdateCompetitor?: (competitor: Market) => void;
}

export const CompetitorAnalysisDrawer = ({ 
  isOpen, 
  onOpenChange, 
  selectedCompetitor,
  isAIViewActive,
  onUpdateCompetitor
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
      case 'summary':
        updatedCompetitor.details.summary = editValue;
        break;
    }

    setCompetitorData(updatedCompetitor);
    
    if (onUpdateCompetitor) {
      onUpdateCompetitor(updatedCompetitor);
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
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Competitor Analysis Details
          </DrawerTitle>
          <DrawerDescription>
            Edit and analyze competitor data
          </DrawerDescription>
        </DrawerHeader>
        
        <div className={`${isAIViewActive ? 'grid grid-cols-3 gap-4' : ''} overflow-auto`}>
          {/* First Section - Competitor Data */}
          <div className={`p-6 overflow-auto ${isAIViewActive ? 'border-r' : ''}`}>
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

              {/* Additional Details Section */}
              {competitorData.details && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Market Details</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Summary</h4>
                      <EditableField
                        field="summary"
                        value={competitorData.details.summary}
                        onEdit={() => handleEdit('summary', competitorData.details.summary)}
                        className="text-sm text-gray-700"
                      />
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Sub-Markets</h4>
                      <div className="space-y-2">
                        {competitorData.details.subMarkets.map((subMarket, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-sm font-medium">{subMarket.name}</span>
                            <div className="text-sm text-gray-600">
                              {subMarket.size} • {subMarket.growth} growth
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Key Insights</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {competitorData.details.keyInsights.map((insight, index) => (
                          <li key={index} className="text-sm text-gray-700">{insight}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Recommended Actions</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {competitorData.details.recommendedActions.map((action, index) => (
                          <li key={index} className="text-sm text-gray-700">{action}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
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
                    {editingField === 'name' && 'Market Name'}
                    {editingField === 'score' && 'Score'}
                    {editingField === 'size' && 'Market Size'}
                    {editingField === 'competition' && 'Competition'}
                    {editingField === 'barriers' && 'Barriers'}
                    {editingField === 'summary' && 'Summary'}
                  </label>
                  
                  {editingField === 'summary' ? (
                    <Textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={6}
                      className="w-full"
                      placeholder={`Enter ${editingField}`}
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
          
          {/* Third Section - AI Prompting (only shown when AI mode is active) */}
          {isAIViewActive && (
            <div className="h-[70vh]">
              <AIPromptingInterface marketName={competitorData.name} />
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
