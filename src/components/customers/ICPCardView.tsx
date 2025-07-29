
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Users, Building, MapPin, Target, Edit, Save, X, RotateCcw } from "lucide-react";

interface SuggestedICP {
  id: string;
  name: string;
  industry: string;
  segment: string;
  companySize: string;
  geography: string;
  leadCount: number;
  decisionMakers: string[];
  keyAttributes: string[];
  growthIndicator?: string;
}

interface ICPCardViewProps {
  icp: SuggestedICP;
  onViewDetails: () => void;
  onEditComplete: () => void;
  onReset: () => void;
}

export const ICPCardView = ({ icp, onViewDetails, onEditComplete, onReset }: ICPCardViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedICP, setEditedICP] = useState(icp);

  const handleEdit = () => {
    setIsEditing(true);
    setEditedICP({ ...icp });
  };

  const handleSave = () => {
    setIsEditing(false);
    onEditComplete();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedICP(icp);
  };

  const handleFieldChange = (field: keyof SuggestedICP, value: any) => {
    setEditedICP(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayFieldChange = (field: 'decisionMakers' | 'keyAttributes', value: string) => {
    const items = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    handleFieldChange(field, items);
  };

  const currentICP = isEditing ? editedICP : icp;

  return (
    <Card className="h-full transition-all duration-200 hover:shadow-lg border-gray-200">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input 
                value={currentICP.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="text-xl font-semibold mb-2"
              />
            ) : (
              <CardTitle className="text-xl text-gray-900 mb-2">
                {currentICP.name}
              </CardTitle>
            )}
            
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1 text-blue-600">
                <Users className="h-4 w-4" />
                <span className="font-medium">{currentICP.leadCount} Matches</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isEditing ? (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 text-green-600" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleEdit}
                className="text-gray-400 hover:text-gray-600"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Tags Row */}
        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <div className="w-full grid grid-cols-2 gap-2">
              <Input
                value={currentICP.industry}
                onChange={(e) => handleFieldChange('industry', e.target.value)}
                placeholder="Industry"
                className="text-sm"
              />
              <Input
                value={currentICP.segment}
                onChange={(e) => handleFieldChange('segment', e.target.value)}
                placeholder="Segment"
                className="text-sm"
              />
            </div>
          ) : (
            <>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Building className="h-3 w-3 mr-1" />
                {currentICP.industry}
              </Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Target className="h-3 w-3 mr-1" />
                {currentICP.segment}
              </Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <MapPin className="h-3 w-3 mr-1" />
                {currentICP.geography}
              </Badge>
            </>
          )}
        </div>

        {/* Company Size */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Building className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600 font-medium">Company Size:</span>
          </div>
          {isEditing ? (
            <Input
              value={currentICP.companySize}
              onChange={(e) => handleFieldChange('companySize', e.target.value)}
              className="ml-6 text-sm"
            />
          ) : (
            <span className="text-gray-700 ml-6 text-sm">{currentICP.companySize}</span>
          )}
        </div>

        {/* Key Buyer Roles */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600 font-medium">Key Buyer Roles:</span>
          </div>
          {isEditing ? (
            <Textarea
              value={currentICP.decisionMakers.join(', ')}
              onChange={(e) => handleArrayFieldChange('decisionMakers', e.target.value)}
              className="ml-6 min-h-[60px] text-sm"
              placeholder="Enter roles separated by commas"
            />
          ) : (
            <div className="flex flex-wrap gap-1 ml-6">
              {currentICP.decisionMakers.map((role, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {role}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Key Attributes */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600 font-medium">Key Attributes:</span>
          </div>
          {isEditing ? (
            <Textarea
              value={currentICP.keyAttributes.join(', ')}
              onChange={(e) => handleArrayFieldChange('keyAttributes', e.target.value)}
              className="ml-6 min-h-[60px] text-sm"
              placeholder="Enter attributes separated by commas"
            />
          ) : (
            <div className="space-y-1 ml-6">
              {currentICP.keyAttributes.map((attribute, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                  <span className="text-gray-700">{attribute}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isEditing && (
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={onViewDetails}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              View ICP Details
            </Button>
            <Button 
              variant="outline" 
              onClick={onReset}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
