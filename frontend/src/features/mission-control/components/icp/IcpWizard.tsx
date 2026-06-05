import { Plus, X, Check, Eye, ChevronsUpDown } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

import type { ICP, FitConfidence } from "../../types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/components/ui/utils";

// Region options (single select)
const REGIONS_OPTIONS = [
  { value: "Europe", label: "Europe" },
  { value: "MEA", label: "MEA (Middle East & Africa)" },
  { value: "APAC", label: "APAC (Asia & Pacific)" },
  { value: "NA", label: "NA (North America)" },
  { value: "LATAM", label: "LATAM (Latin America)" },
];

const INDUSTRY_SUGGESTIONS = [
  "SaaS",
  "Fintech",
  "Healthcare",
  "E-commerce",
  "Manufacturing",
  "Logistics",
  "Education",
  "Real Estate",
  "Media & Entertainment",
  "Professional Services",
  "Consulting",
];

const COMPANY_SIZE_OPTIONS = ["1–10", "11–50", "51–200", "201–500", "501–1000", "1000+"];

const BUYER_ROLE_SUGGESTIONS = [
  "VP of Sales",
  "CTO",
  "CEO",
  "Head of Marketing",
  "VP of Engineering",
  "CFO",
  "Director of Operations",
  "Product Manager",
  "Head of Growth",
  "CMO",
];

const FIT_CONFIDENCE_OPTIONS: { value: FitConfidence; label: string }[] = [
  { value: "high", label: "High - proven and repeatable" },
  { value: "medium", label: "Medium - some wins, still learning" },
  { value: "low", label: "Low - exploratory" },
];

export interface IcpWizardProps {
  /** undefined = add mode; defined = edit mode — seeds form via useEffect([initial]). */
  initial?: ICP;
  /** Container does setIcps + backend save + toast + dispatch + close. */
  onSaved: (icp: ICP, isEdit: boolean) => void;
  /** Container clears editing + closes. */
  onCancel: () => void;
}

/**
 * Self-contained ICP add/edit wizard. Owns its form state, validation, and
 * ICP assembly; it does NOT persist. On a valid Save it emits the assembled
 * `ICP` via `onSaved(icp, isEdit)`; the container owns the write side
 * (optimistic `setIcps`, backend save, toast, `customerProfileSaved` dispatch).
 *
 * The validation rules and assembled-ICP field expressions are byte-faithful to
 * the legacy `handleSaveICP` in ICPManager so the create/edit journey is parity.
 */
const IcpWizard: React.FC<IcpWizardProps> = ({ initial, onSaved, onCancel }) => {
  const { toast } = useToast();
  const isEdit = !!initial;

  // Form state (moved from the container).
  const [primaryRegion, setPrimaryRegion] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [industryInput, setIndustryInput] = useState("");
  const [isIndustryPopoverOpen, setIsIndustryPopoverOpen] = useState(false);
  const [selectedCompanySizes, setSelectedCompanySizes] = useState<string[]>([]);
  const [isCompanySizePopoverOpen, setIsCompanySizePopoverOpen] = useState(false);
  const [selectedBuyerRoles, setSelectedBuyerRoles] = useState<string[]>([]);
  const [buyerRoleInput, setBuyerRoleInput] = useState("");
  const [isBuyerRolePopoverOpen, setIsBuyerRolePopoverOpen] = useState(false);
  const [accountsOnWatchlist, setAccountsOnWatchlist] = useState<string[]>([]);
  const [watchlistInput, setWatchlistInput] = useState("");
  const [accountsToAvoid, setAccountsToAvoid] = useState<string[]>([]);
  const [avoidInput, setAvoidInput] = useState("");
  const [fitConfidence, setFitConfidence] = useState<FitConfidence | "">("");
  const [additionalContext, setAdditionalContext] = useState("");

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{
    primaryRegion?: string;
    industry?: string;
    companySize?: string;
    buyerRole?: string;
    fitConfidence?: string;
  }>({});

  const industryRef = useRef<HTMLInputElement>(null);
  const buyerRoleRef = useRef<HTMLInputElement>(null);

  // Seed (edit mode) or clear (add mode) the form whenever the controlled
  // `initial` reference changes. The container passes a memoized `initial` so
  // this does not re-seed on every render.
  useEffect(() => {
    if (initial) {
      setPrimaryRegion(initial.primaryRegion);
      setLocations(initial.location || []);
      setLocationInput("");
      setSelectedIndustries(initial.industry);
      setSelectedCompanySizes(initial.companySize);
      setSelectedBuyerRoles(initial.buyerRole);
      setBuyerRoleInput("");
      setAccountsOnWatchlist(initial.accountsOnWatchlist || []);
      setWatchlistInput("");
      setAccountsToAvoid(initial.accountsToAvoid || []);
      setAvoidInput("");
      setFitConfidence(initial.fitConfidence);
      setAdditionalContext(initial.additionalContext);
      setValidationErrors({});
    } else {
      setPrimaryRegion("");
      setLocations([]);
      setLocationInput("");
      setSelectedIndustries([]);
      setIndustryInput("");
      setIsIndustryPopoverOpen(false);
      setSelectedCompanySizes([]);
      setIsCompanySizePopoverOpen(false);
      setSelectedBuyerRoles([]);
      setBuyerRoleInput("");
      setIsBuyerRolePopoverOpen(false);
      setValidationErrors({});
      setAccountsOnWatchlist([]);
      setWatchlistInput("");
      setAccountsToAvoid([]);
      setAvoidInput("");
      setFitConfidence("");
      setAdditionalContext("");
    }
  }, [initial]);

  const handleFitConfidenceSelect = (value: FitConfidence) => {
    setFitConfidence(value);
    if (validationErrors.fitConfidence) {
      setValidationErrors((prev) => ({ ...prev, fitConfidence: undefined }));
    }
  };

  const handleIndustryToggle = (industry: string) => {
    if (!selectedIndustries.includes(industry)) {
      setSelectedIndustries((prev) => {
        const updated = [...prev, industry];
        if (validationErrors.industry && updated.length > 0) {
          setValidationErrors((prev) => ({ ...prev, industry: undefined }));
        }
        return updated;
      });
    }
    setIndustryInput("");
    setIsIndustryPopoverOpen(false);
  };

  const handleIndustryInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && industryInput.trim()) {
      e.preventDefault();
      const trimmedInput = industryInput.trim();
      if (!selectedIndustries.includes(trimmedInput)) {
        setSelectedIndustries((prev) => {
          const updated = [...prev, trimmedInput];
          if (validationErrors.industry && updated.length > 0) {
            setValidationErrors((prev) => ({ ...prev, industry: undefined }));
          }
          return updated;
        });
      }
      setIndustryInput("");
      setIsIndustryPopoverOpen(false);
    }
  };

  const handleCompanySizeToggle = (size: string) => {
    if (!selectedCompanySizes.includes(size)) {
      setSelectedCompanySizes((prev) => {
        const updated = [...prev, size];
        if (validationErrors.companySize && updated.length > 0) {
          setValidationErrors((prev) => ({ ...prev, companySize: undefined }));
        }
        return updated;
      });
    }
    setIsCompanySizePopoverOpen(false);
  };

  const handleBuyerRoleToggle = (role: string) => {
    if (!selectedBuyerRoles.includes(role)) {
      setSelectedBuyerRoles((prev) => {
        const updated = [...prev, role];
        if (validationErrors.buyerRole && updated.length > 0) {
          setValidationErrors((prev) => ({ ...prev, buyerRole: undefined }));
        }
        return updated;
      });
    }
    setBuyerRoleInput("");
    setIsBuyerRolePopoverOpen(false);
  };

  const handleBuyerRoleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && buyerRoleInput.trim()) {
      e.preventDefault();
      const trimmedInput = buyerRoleInput.trim();
      if (!selectedBuyerRoles.includes(trimmedInput)) {
        setSelectedBuyerRoles((prev) => {
          const updated = [...prev, trimmedInput];
          if (validationErrors.buyerRole && updated.length > 0) {
            setValidationErrors((prev) => ({ ...prev, buyerRole: undefined }));
          }
          return updated;
        });
      }
      setBuyerRoleInput("");
      setIsBuyerRolePopoverOpen(false);
    }
  };

  const handleAddLocation = () => {
    if (locationInput.trim()) {
      const trimmedLocation = locationInput.trim();
      if (!locations.includes(trimmedLocation)) {
        setLocations((prev) => [...prev, trimmedLocation]);
      }
      setLocationInput("");
    }
  };

  const handleLocationInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && locationInput.trim()) {
      e.preventDefault();
      handleAddLocation();
    }
  };

  const handleRemoveLocation = (locationToRemove: string) => {
    setLocations((prev) => prev.filter((loc) => loc !== locationToRemove));
  };

  const handleAddWatchlist = () => {
    if (watchlistInput.trim()) {
      const trimmedCompany = watchlistInput.trim();
      if (!accountsOnWatchlist.includes(trimmedCompany)) {
        setAccountsOnWatchlist((prev) => [...prev, trimmedCompany]);
      }
      setWatchlistInput("");
    }
  };

  const handleWatchlistInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && watchlistInput.trim()) {
      e.preventDefault();
      handleAddWatchlist();
    }
  };

  const handleRemoveWatchlist = (companyToRemove: string) => {
    setAccountsOnWatchlist((prev) => prev.filter((company) => company !== companyToRemove));
  };

  const handleAddAvoid = () => {
    if (avoidInput.trim()) {
      const trimmedCompany = avoidInput.trim();
      if (!accountsToAvoid.includes(trimmedCompany)) {
        setAccountsToAvoid((prev) => [...prev, trimmedCompany]);
      }
      setAvoidInput("");
    }
  };

  const handleAvoidInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && avoidInput.trim()) {
      e.preventDefault();
      handleAddAvoid();
    }
  };

  const handleRemoveAvoid = (companyToRemove: string) => {
    setAccountsToAvoid((prev) => prev.filter((company) => company !== companyToRemove));
  };

  // Validate + assemble. Byte-faithful to the legacy `handleSaveICP` validation
  // and ICP-assembly; the persistence side (setIcps/backend/toast/dispatch) is
  // the container's job via `onSaved`.
  const handleSave = () => {
    const errors: typeof validationErrors = {};
    let hasErrors = false;

    if (!primaryRegion.trim()) {
      errors.primaryRegion = "Please select a region";
      hasErrors = true;
    }

    if (selectedIndustries.length === 0) {
      errors.industry = "Please select at least one industry";
      hasErrors = true;
    }

    if (selectedCompanySizes.length === 0) {
      errors.companySize = "Please select at least one company size";
      hasErrors = true;
    }

    if (selectedBuyerRoles.length === 0) {
      errors.buyerRole = "Please select at least one job title";
      hasErrors = true;
    }

    if (!fitConfidence) {
      errors.fitConfidence = "Please select an ICP fit level";
      hasErrors = true;
    }

    if (hasErrors) {
      setValidationErrors(errors);
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Clear errors if validation passes
    setValidationErrors({});

    // Commit typed location that is not yet added as a tag (same as Enter / Add button)
    const pendingLocation = locationInput.trim();
    const locationCommitted = [...locations];
    if (pendingLocation && !locationCommitted.includes(pendingLocation)) {
      locationCommitted.push(pendingLocation);
    }

    const newICP: ICP = {
      id: initial?.id || `icp-${Date.now()}`,
      primaryRegion: primaryRegion.trim(),
      location: locationCommitted.filter((loc) => loc.trim() !== ""),
      industry: selectedIndustries,
      companySize: selectedCompanySizes,
      buyerRole: selectedBuyerRoles,
      accountsOnWatchlist: accountsOnWatchlist,
      accountsToAvoid: accountsToAvoid,
      fitConfidence: fitConfidence as FitConfidence,
      additionalContext: additionalContext.trim(),
      status: "saved",
      createdAt: new Date(),
    };

    onSaved(newICP, isEdit);
  };

  return (
    <div className="bg-white border border-black rounded-lg p-4 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-foreground">
          {isEdit ? "Edit ICP" : "Add New ICP"}
        </h4>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Compact Form Layout - No Category Headers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Regions - Single Select Dropdown */}
        <div className="space-y-1.5">
          <Label>Regions</Label>
          <Select
            value={primaryRegion}
            onValueChange={(value) => {
              setPrimaryRegion(value);
              if (validationErrors.primaryRegion) {
                setValidationErrors((prev) => ({ ...prev, primaryRegion: undefined }));
              }
            }}
          >
            <SelectTrigger
              className={cn(
                "h-9 text-sm font-normal",
                validationErrors.primaryRegion && "border-destructive",
              )}
            >
              <SelectValue placeholder="Select region..." />
            </SelectTrigger>
            <SelectContent>
              {REGIONS_OPTIONS.map((region) => (
                <SelectItem key={region.value} value={region.value}>
                  {region.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors.primaryRegion && (
            <p className="text-xs text-destructive">{validationErrors.primaryRegion}</p>
          )}
        </div>

        {/* Location - Input with Tags */}
        <div className="space-y-1.5">
          <Label>Location</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter location..."
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={handleLocationInputKeyDown}
              className="h-9 text-sm w-32"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLocation}
                    disabled={!locationInput.trim()}
                    className="h-9 px-3"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to add location</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {locations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {locations.map((location) => (
                <Badge
                  key={location}
                  variant="default"
                  className="text-xs cursor-pointer"
                  onClick={() => handleRemoveLocation(location)}
                >
                  {location} ×
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Industry</Label>
          <Popover
            open={isIndustryPopoverOpen}
            onOpenChange={setIsIndustryPopoverOpen}
            modal={false}
          >
            <div className="relative">
              <Input
                ref={industryRef}
                placeholder="Type or Select"
                value={industryInput}
                onChange={(e) => {
                  setIndustryInput(e.target.value);
                  setIsIndustryPopoverOpen(true);
                }}
                onClick={() => {
                  setIsIndustryPopoverOpen(true);
                }}
                onBlur={(_e) => {
                  // Delay to allow click events in popover
                  setTimeout(() => {
                    const activeElement = document.activeElement;
                    const popoverContent = document.querySelector('[role="dialog"]');
                    if (
                      !popoverContent?.contains(activeElement) &&
                      activeElement !== industryRef.current
                    ) {
                      setIsIndustryPopoverOpen(false);
                    }
                  }, 200);
                }}
                onKeyDown={handleIndustryInputKeyDown}
                className={cn(
                  "h-9 text-sm pr-8",
                  validationErrors.industry && "border-destructive",
                )}
              />
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="absolute inset-0 h-9 w-full opacity-0"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsIndustryPopoverOpen(true);
                    industryRef.current?.focus();
                  }}
                  type="button"
                  tabIndex={-1}
                />
              </PopoverTrigger>
              <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none z-10" />
            </div>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]"
              side="bottom"
              align="start"
              sideOffset={4}
              avoidCollisions={false}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                industryRef.current?.focus();
              }}
            >
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandEmpty>
                    {industryInput.trim() ? (
                      <div className="py-2 text-sm text-muted-foreground">
                        Press Enter to add "{industryInput.trim()}"
                      </div>
                    ) : (
                      "No industry found."
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {INDUSTRY_SUGGESTIONS.filter(
                      (industry) =>
                        !selectedIndustries.includes(industry) &&
                        industry.toLowerCase().includes(industryInput.toLowerCase()),
                    ).map((industry) => (
                      <CommandItem
                        key={industry}
                        value={industry}
                        onSelect={(currentValue) => {
                          handleIndustryToggle(currentValue);
                          setIsIndustryPopoverOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                        {industry}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedIndustries.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedIndustries.map((ind) => (
                <Badge
                  key={ind}
                  variant="default"
                  className="text-xs cursor-pointer"
                  onClick={() => {
                    setSelectedIndustries((prev) => {
                      const updated = prev.filter((i) => i !== ind);
                      if (updated.length === 0 && !validationErrors.industry) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          industry: "Please select at least one industry",
                        }));
                      }
                      return updated;
                    });
                  }}
                >
                  {ind} ×
                </Badge>
              ))}
            </div>
          )}
          {validationErrors.industry && (
            <p className="text-xs text-destructive">{validationErrors.industry}</p>
          )}
        </div>

        {/* Company Size - Multiselect Dropdown */}
        <div className="space-y-1.5">
          <Label>Company Size</Label>
          <Popover open={isCompanySizePopoverOpen} onOpenChange={setIsCompanySizePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className={cn(
                  "w-full justify-between h-9 text-sm font-normal",
                  validationErrors.companySize && "border-destructive",
                )}
                onClick={() => setIsCompanySizePopoverOpen(!isCompanySizePopoverOpen)}
              >
                {selectedCompanySizes.length > 0
                  ? `${selectedCompanySizes.length} selected`
                  : "Select company size..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]"
              side="bottom"
              align="start"
              sideOffset={4}
            >
              <Command>
                <CommandList>
                  <CommandEmpty>No company size found.</CommandEmpty>
                  <CommandGroup>
                    {COMPANY_SIZE_OPTIONS.filter(
                      (size) => !selectedCompanySizes.includes(size),
                    ).map((size) => (
                      <CommandItem
                        key={size}
                        value={size}
                        onSelect={() => {
                          handleCompanySizeToggle(size);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                        {size}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedCompanySizes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedCompanySizes.map((size) => (
                <Badge
                  key={size}
                  variant="default"
                  className="text-xs cursor-pointer"
                  onClick={() => {
                    setSelectedCompanySizes((prev) => {
                      const updated = prev.filter((s) => s !== size);
                      if (updated.length === 0 && !validationErrors.companySize) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          companySize: "Please select at least one company size",
                        }));
                      }
                      return updated;
                    });
                  }}
                >
                  {size} ×
                </Badge>
              ))}
            </div>
          )}
          {validationErrors.companySize && (
            <p className="text-xs text-destructive">{validationErrors.companySize}</p>
          )}
        </div>

        {/* Job Title - Input with Tags */}
        <div className="space-y-1.5">
          <Label>Job Title</Label>
          <Popover
            open={isBuyerRolePopoverOpen}
            onOpenChange={setIsBuyerRolePopoverOpen}
            modal={false}
          >
            <div className="relative">
              <Input
                ref={buyerRoleRef}
                placeholder="Type or Select"
                value={buyerRoleInput}
                onChange={(e) => {
                  setBuyerRoleInput(e.target.value);
                  setIsBuyerRolePopoverOpen(true);
                }}
                onClick={() => {
                  setIsBuyerRolePopoverOpen(true);
                }}
                onBlur={(_e) => {
                  // Delay to allow click events in popover
                  setTimeout(() => {
                    const activeElement = document.activeElement;
                    const popoverContent = document.querySelector('[role="dialog"]');
                    if (
                      !popoverContent?.contains(activeElement) &&
                      activeElement !== buyerRoleRef.current
                    ) {
                      setIsBuyerRolePopoverOpen(false);
                    }
                  }, 200);
                }}
                onKeyDown={handleBuyerRoleInputKeyDown}
                className={cn(
                  "h-9 text-sm pr-8",
                  validationErrors.buyerRole && "border-destructive",
                )}
              />
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="absolute inset-0 h-9 w-full opacity-0"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsBuyerRolePopoverOpen(true);
                    buyerRoleRef.current?.focus();
                  }}
                  type="button"
                  tabIndex={-1}
                />
              </PopoverTrigger>
              <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none z-10" />
            </div>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]"
              side="bottom"
              align="start"
              sideOffset={4}
              avoidCollisions={false}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                buyerRoleRef.current?.focus();
              }}
            >
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandEmpty>
                    {buyerRoleInput.trim() ? (
                      <div className="py-2 text-sm text-muted-foreground">
                        Press Enter to add "{buyerRoleInput.trim()}"
                      </div>
                    ) : (
                      "No job title found."
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {BUYER_ROLE_SUGGESTIONS.filter(
                      (role) =>
                        !selectedBuyerRoles.includes(role) &&
                        role.toLowerCase().includes(buyerRoleInput.toLowerCase()),
                    ).map((role) => (
                      <CommandItem
                        key={role}
                        value={role}
                        onSelect={(currentValue) => {
                          handleBuyerRoleToggle(currentValue);
                          setIsBuyerRolePopoverOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                        {role}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedBuyerRoles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedBuyerRoles.map((role) => (
                <Badge
                  key={role}
                  variant="default"
                  className="text-xs cursor-pointer"
                  onClick={() => {
                    setSelectedBuyerRoles((prev) => {
                      const updated = prev.filter((r) => r !== role);
                      if (updated.length === 0 && !validationErrors.buyerRole) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          buyerRole: "Please select at least one job title",
                        }));
                      }
                      return updated;
                    });
                  }}
                >
                  {role} ×
                </Badge>
              ))}
            </div>
          )}
          {validationErrors.buyerRole && (
            <p className="text-xs text-destructive">{validationErrors.buyerRole}</p>
          )}
        </div>

        {/* ICP Fit - Simple Dropdown */}
        <div className="space-y-1.5">
          <Label>ICP Fit</Label>
          <Select
            value={fitConfidence}
            onValueChange={(value) => handleFitConfidenceSelect(value as FitConfidence)}
          >
            <SelectTrigger
              className={cn(
                "h-9 text-sm font-normal",
                validationErrors.fitConfidence && "border-destructive",
              )}
            >
              <SelectValue placeholder="Select ICP fit..." />
            </SelectTrigger>
            <SelectContent>
              {FIT_CONFIDENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors.fitConfidence && (
            <p className="text-xs text-destructive">{validationErrors.fitConfidence}</p>
          )}
        </div>
      </div>

      {/* Companies on Watchlist and Companies to Exclude - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Eye className="h-3 w-3" />
            Companies on Watchlist (Optional)
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter company name..."
              value={watchlistInput}
              onChange={(e) => setWatchlistInput(e.target.value)}
              onKeyDown={handleWatchlistInputKeyDown}
              className="h-9 text-sm flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddWatchlist}
              disabled={!watchlistInput.trim()}
              className="h-9 px-3"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {accountsOnWatchlist.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {accountsOnWatchlist.map((company) => (
                <Badge
                  key={company}
                  variant="default"
                  className="text-xs cursor-pointer"
                  onClick={() => handleRemoveWatchlist(company)}
                >
                  {company} ×
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground/70">
            Companies you want to closely monitor or track for opportunities.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Companies to Exclude (Optional)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter company name..."
              value={avoidInput}
              onChange={(e) => setAvoidInput(e.target.value)}
              onKeyDown={handleAvoidInputKeyDown}
              className="h-9 text-sm flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddAvoid}
              disabled={!avoidInput.trim()}
              className="h-9 px-3"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {accountsToAvoid.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {accountsToAvoid.map((company) => (
                <Badge
                  key={company}
                  variant="default"
                  className="text-xs cursor-pointer"
                  onClick={() => handleRemoveAvoid(company)}
                >
                  {company} ×
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Additional Criteria - Full Width */}
      <div className="space-y-2 pt-2 border-t">
        <Label className="font-semibold">Additional Criteria</Label>
        <Input
          placeholder="Any additional criteria or specific requirements for your ICP..."
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          className="h-9 text-sm"
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} className="gap-1">
          <Check className="h-4 w-4" />
          Save
        </Button>
      </div>
    </div>
  );
};

export default IcpWizard;
