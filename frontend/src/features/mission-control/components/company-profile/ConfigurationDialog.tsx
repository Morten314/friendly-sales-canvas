import type { DataSource } from "./connectorTypes";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: DataSource | null;
  syncFrequency: DataSource["syncFrequency"];
  objects: string[];
  filters: string[];
  onSyncFrequencyChange: (value: DataSource["syncFrequency"]) => void;
  onObjectsChange: (objects: string[]) => void;
  onFiltersChange: (filters: string[]) => void;
  onSave: () => void;
}

export default function ConfigurationDialog({
  open,
  onOpenChange,
  source,
  syncFrequency,
  objects,
  filters,
  onSyncFrequencyChange,
  onObjectsChange,
  onFiltersChange,
  onSave,
}: ConfigurationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {source?.name}</DialogTitle>
          <DialogDescription>
            Manage sync settings, objects, and filters for this data source
          </DialogDescription>
        </DialogHeader>

        {source && (
          <div className="space-y-6 pt-4">
            {/* Sync Frequency */}
            <div className="space-y-2">
              <Label>Sync Frequency</Label>
              <Select
                value={syncFrequency}
                onValueChange={(value: string) =>
                  onSyncFrequencyChange(value as DataSource["syncFrequency"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Real-time</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="4hours">Every 4 Hours</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="manual">Manual Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often data should be synchronized from {source.name}
              </p>
            </div>

            {/* Objects to Sync */}
            {source.type === "crm" && (
              <div className="space-y-2">
                <Label>Objects to Sync</Label>
                <div className="space-y-2 border rounded-md p-4">
                  {["Contacts", "Accounts", "Opportunities", "Leads", "Deals", "Activities"].map(
                    (obj) => {
                      const isChecked = objects.includes(obj);
                      return (
                        <div key={obj} className="flex items-center space-x-2">
                          <Checkbox
                            id={`obj-${obj}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                onObjectsChange([...objects, obj]);
                              } else {
                                onObjectsChange(objects.filter((o) => o !== obj));
                              }
                            }}
                          />
                          <label
                            htmlFor={`obj-${obj}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {obj}
                          </label>
                        </div>
                      );
                    },
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select which CRM objects to synchronize
                </p>
              </div>
            )}

            {source.type === "social" && (
              <div className="space-y-2">
                <Label>Data Types to Sync</Label>
                <div className="space-y-2 border rounded-md p-4">
                  {["Company Pages", "Profiles", "Posts", "Engagements"].map((obj) => {
                    const isChecked = objects.includes(obj);
                    return (
                      <div key={obj} className="flex items-center space-x-2">
                        <Checkbox
                          id={`obj-${obj}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              onObjectsChange([...objects, obj]);
                            } else {
                              onObjectsChange(objects.filter((o) => o !== obj));
                            }
                          }}
                        />
                        <label
                          htmlFor={`obj-${obj}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {obj}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {source.type === "analytics" && (
              <div className="space-y-2">
                <Label>Events to Sync</Label>
                <div className="space-y-2 border rounded-md p-4">
                  {["Page Views", "Events", "User Actions", "Conversions"].map((obj) => {
                    const isChecked = objects.includes(obj);
                    return (
                      <div key={obj} className="flex items-center space-x-2">
                        <Checkbox
                          id={`obj-${obj}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              onObjectsChange([...objects, obj]);
                            } else {
                              onObjectsChange(objects.filter((o) => o !== obj));
                            }
                          }}
                        />
                        <label
                          htmlFor={`obj-${obj}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {obj}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filters */}
            {source.type === "crm" && (
              <div className="space-y-2">
                <Label>Filters</Label>
                <div className="space-y-2 border rounded-md p-4">
                  {[
                    "Active records only",
                    "Last 90 days",
                    "Exclude archived",
                    "High-value accounts only",
                  ].map((filter) => {
                    const isChecked = filters.includes(filter);
                    return (
                      <div key={filter} className="flex items-center space-x-2">
                        <Checkbox
                          id={`filter-${filter}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              onFiltersChange([...filters, filter]);
                            } else {
                              onFiltersChange(filters.filter((f) => f !== filter));
                            }
                          }}
                        />
                        <label
                          htmlFor={`filter-${filter}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {filter}
                        </label>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Apply filters to limit which records are synchronized
                </p>
              </div>
            )}

            {/* Current Configuration Summary */}
            <div className="space-y-2 pt-4 border-t">
              <Label>Current Configuration</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Objects Synced: {objects.length > 0 ? objects.join(", ") : "None"}</p>
                <p>Filters: {filters.length > 0 ? filters.join(", ") : "None"}</p>
                <p>Fields Mapped: {source.fieldsMapped}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onSave}>Save Configuration</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
