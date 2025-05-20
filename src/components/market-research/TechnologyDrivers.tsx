import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layers } from "lucide-react";

interface TechnologyDriver {
  technology: string;
  maturity: string;
  relevance: string;
  timeToAdopt: string;
}

interface TechnologyDriversProps {
  technologyDrivers: TechnologyDriver[];
}

export const TechnologyDrivers = ({ technologyDrivers }: TechnologyDriversProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-600" /> Technology Drivers
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
            {technologyDrivers.map((tech, index) => (
              <TableRow key={index}>
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
  );
};
