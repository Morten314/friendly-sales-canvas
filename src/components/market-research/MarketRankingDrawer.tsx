
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
import { TrendingUp, Edit3, Save, X } from "lucide-react";
import { useState, useEffect } from "react";

interface MarketRanking {
  marketName: string;
  score: string;
  tam: string;
  competition: string;
  barriers: string;
}

interface MarketRankingDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedRanking: MarketRanking | null;
  isAIViewActive: boolean;
}

export const MarketRankingDrawer = ({ 
  isOpen, 
  onOpenChange, 
  selectedRanking,
  isAIViewActive
}: MarketRankingDrawerProps) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [rankingData, setRankingData] = useState<MarketRanking | null>(selectedRanking);

  // Update local state when selectedRanking changes
  useEffect(() => {
    setRankingData(selectedRanking);
  }, [selectedRanking]);

  if (!rankingData) return null;

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSave = () => {
    if (!editingField || !rankingData) return;

    const updatedRanking = { ...rankingData };

    switch (editingField) {
      case 'marketName':
        updatedRanking.marketName = editValue;
        break;
      case 'score':
        updatedRanking.score = editValue;
        break;
      case 'tam':
        updatedRanking.tam = editValue;
        break;
      case 'competition':
        updatedRanking.competition = editValue;
        break;
      case 'barriers':
        updatedRanking.barriers = editValue;
        break;
    }

    setRankingData(updatedRanking);
    handleCancel();
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue("");
  };

  const getCompetitionColor = (competition: string) => {
    switch (competition.toLowerCase()) {
      case 'low':
        return "text-green-600";
      case 'medium':
        return "text-yellow-600";
      case 'high':
        return "text-orange-600";
      case 'very high':
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getBarrierColor = (barrier: string) => {
    switch (barrier.toLowerCase()) {
      case 'low':
        return "text-green-600";
      case 'medium':
        return "text-yellow-600";
      case 'high':
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getScoreColor = (score: string) => {
    const numericScore = parseInt(score.split('/')[0]);
    if (numericScore >= 90) return "text-green-600 font-semibold";
    if (numericScore >= 80) return "text-blue-600 font-semibold";
    if (numericScore >= 70) return "text-yellow-600 font-semibold";
    return "text-gray-600 font-medium";
  };

  const EditableField = ({ 
    field, 
    value, 
    onEdit, 
    className = "",
    colorClass = ""
  }: { 
    field: string; 
    value: string; 
    onEdit: () => void; 
    className?: string;
    colorClass?: string;
  }) => (
    <div className={`group relative ${className}`}>
      <span className={`block ${colorClass}`}>{value}</span>
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
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Market Ranking Details
          </DrawerTitle>
          <DrawerDescription>
            Edit and analyze market ranking data
          </DrawerDescription>
        </DrawerHeader>
        
        <div className={`${isAIViewActive && editingField ? 'grid grid-cols-2 gap-4' : ''} overflow-auto`}>
          {/* First Section - Market Ranking Details */}
          <div className={`p-6 overflow-auto ${isAIViewActive && editingField ? 'border-r' : ''}`}>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Market Name</h3>
                  <EditableField
                    field="marketName"
                    value={rankingData.marketName}
                    onEdit={() => handleEdit('marketName', rankingData.marketName)}
                    className="text-lg font-semibold"
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Market Score</h3>
                  <EditableField
                    field="score"
                    value={rankingData.score}
                    onEdit={() => handleEdit('score', rankingData.score)}
                    colorClass={getScoreColor(rankingData.score)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Total Addressable Market (TAM)</h3>
                  <EditableField
                    field="tam"
                    value={rankingData.tam}
                    onEdit={() => handleEdit('tam', rankingData.tam)}
                    className="font-medium text-gray-900"
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Competition Level</h3>
                  <EditableField
                    field="competition"
                    value={rankingData.competition}
                    onEdit={() => handleEdit('competition', rankingData.competition)}
                    colorClass={getCompetitionColor(rankingData.competition)}
                  />
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Entry Barriers</h3>
                <EditableField
                  field="barriers"
                  value={rankingData.barriers}
                  onEdit={() => handleEdit('barriers', rankingData.barriers)}
                  colorClass={getBarrierColor(rankingData.barriers)}
                />
              </div>
            </div>
          </div>
          
          {/* Second Section - Editing Area (only shown when AI mode is active and editing) */}
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
                    {editingField === 'marketName' && 'Market Name'}
                    {editingField === 'score' && 'Market Score'}
                    {editingField === 'tam' && 'Total Addressable Market (TAM)'}
                    {editingField === 'competition' && 'Competition Level'}
                    {editingField === 'barriers' && 'Entry Barriers'}
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
            Generate Full Analysis
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
