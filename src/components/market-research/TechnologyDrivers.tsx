
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Layers, Bot } from "lucide-react";
import { useState, useEffect } from "react";
import { TechnologyDriversDrawer } from "./TechnologyDriversDrawer";

interface TechnologyDriver {
  technology: string;
  maturity: string;
  relevance: string;
  timeToAdopt: string;
}

interface TechnologyDriversProps {
  technologyDrivers: TechnologyDriver[];
  isAIViewActive?: boolean;
}

export const TechnologyDrivers = ({ technologyDrivers, isAIViewActive = false }: TechnologyDriversProps) => {
  const [selectedTechnology, setSelectedTechnology] = useState<TechnologyDriver | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [localDrivers, setLocalDrivers] = useState<TechnologyDriver[]>(technologyDrivers);

  // Update local state when props change
  useEffect(() => {
    setLocalDrivers(technologyDrivers);
  }, [technologyDrivers]);

  const handleRowClick = (technology: TechnologyDriver) => {
    console.log('TechnologyDrivers: Row clicked', technology, 'AI View Active:', isAIViewActive);
    if (isAIViewActive) {
      setSelectedTechnology(technology);
      setIsDrawerOpen(true);
    }
  };

  const handleUpdateTechnology = (updatedTechnology: TechnologyDriver) => {
    setLocalDrivers(prevDrivers => 
      prevDrivers.map(driver => 
        driver.technology === selectedTechnology?.technology ? updatedTechnology : driver
      )
    );
    // Also update the selected technology to reflect changes immediately
    setSelectedTechnology(updatedTechnology);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" /> Technology Drivers
            {isAIViewActive && (
              <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700 border-purple-200">
                <Bot className="h-3 w-3 mr-1" />
                AI Enhanced
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Technologies shaping market evolution</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Technology</TableHead>
                <TableHead>Maturity Level</TableHead>
                <TableHead>Business Relevance</TableHead>
                <TableHead>Time to Adopt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localDrivers.map((tech, index) => (
                <TableRow 
                  key={index}
                  className={`transition-colors ${
                    isAIViewActive 
                      ? 'hover:bg-blue-50 cursor-pointer' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleRowClick(tech)}
                >
                  <TableCell className="font-medium">{tech.technology}</TableCell>
                  <TableCell>{tech.maturity}</TableCell>
                  <TableCell>{tech.relevance}</TableCell>
                  <TableCell>{tech.timeToAdopt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TechnologyDriversDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        selectedTechnology={selectedTechnology}
        isAIViewActive={isAIViewActive}
        onUpdateTechnology={handleUpdateTechnology}
      />
    </>
  );
};
