import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";

export interface LeadStreamFilters {
  selectedIndustry: string;
  selectedSize: string;
  selectedRegion: string;
}

interface LeadStreamFilterBarProps {
  filters: LeadStreamFilters;
  onFiltersChange: (filters: LeadStreamFilters) => void;
}

const INDUSTRIES = ["all", "SaaS", "FinTech", "Healthcare", "E-commerce", "Manufacturing", "Other"];
const SIZES = ["all", "1-10", "11-50", "51-200", "201-500", "500+"];
const REGIONS = ["all", "North America", "Europe", "APAC", "LATAM", "Other"];

export function LeadStreamFilterBar({ filters, onFiltersChange }: LeadStreamFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        Filters
      </div>
      <Select
        value={filters.selectedIndustry}
        onValueChange={(v) => onFiltersChange({ ...filters, selectedIndustry: v })}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder="Industry" />
        </SelectTrigger>
        <SelectContent>
          {INDUSTRIES.map((i) => (
            <SelectItem key={i} value={i}>
              {i === "all" ? "All industries" : i}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.selectedSize}
        onValueChange={(v) => onFiltersChange({ ...filters, selectedSize: v })}
      >
        <SelectTrigger className="w-[120px] h-8">
          <SelectValue placeholder="Size" />
        </SelectTrigger>
        <SelectContent>
          {SIZES.map((s) => (
            <SelectItem key={s} value={s}>
              {s === "all" ? "All sizes" : s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.selectedRegion}
        onValueChange={(v) => onFiltersChange({ ...filters, selectedRegion: v })}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          {REGIONS.map((r) => (
            <SelectItem key={r} value={r}>
              {r === "all" ? "All regions" : r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(filters.selectedIndustry !== "all" ||
        filters.selectedSize !== "all" ||
        filters.selectedRegion !== "all") && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() =>
            onFiltersChange({
              selectedIndustry: "all",
              selectedSize: "all",
              selectedRegion: "all",
            })
          }
        >
          Clear
        </Button>
      )}
    </div>
  );
}
