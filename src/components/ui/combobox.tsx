import { Check, ChevronsUpDown, Plus } from "lucide-react";
import * as React from "react";

import { cn } from "./utils";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface CreatableComboboxProps {
  /** The committed value (a free string — may be a preset option or custom text). */
  value: string;
  /** Called with the chosen preset or the typed custom value. */
  onChange: (value: string) => void;
  /** Suggested values surfaced in the dropdown. Custom input is always allowed. */
  options: readonly string[];
  /** Trigger text shown when no value is set. */
  placeholder?: string;
  /** Placeholder for the in-popover search/add input. */
  searchPlaceholder?: string;
  /** Forwarded to the trigger so an external <Label htmlFor> can target it. */
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Single-select combobox that also accepts free-form input: type to filter the
 * suggested `options`, pick one, or add a value not in the list via the
 * "Add …" affordance. Composed from the locked Popover + cmdk Command
 * primitives (same pattern as the multi-select comboboxes in IcpWizard).
 */
export function CreatableCombobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search or add…",
  id,
  className,
  disabled,
}: CreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();
  const filtered = trimmed ? options.filter((o) => o.toLowerCase().includes(lowerQuery)) : options;
  const hasExactMatch = options.some((o) => o.toLowerCase() === lowerQuery);
  const showCreate = trimmed !== "" && !hasExactMatch;

  function commit(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {/* Manual filtering (shouldFilter={false}) so the "Add …" create row is
            driven by our own exact-match check rather than cmdk's fuzzy matcher. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandGroup>
              {filtered.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => commit(option)}>
                  <Check
                    className={cn("mr-2 h-4 w-4", value === option ? "opacity-100" : "opacity-0")}
                  />
                  {option}
                </CommandItem>
              ))}
              {showCreate && (
                <CommandItem
                  // Distinct value so cmdk keys it separately; we commit the
                  // trimmed query rather than cmdk's normalized callback arg.
                  value={`__create__:${trimmed}`}
                  onSelect={() => commit(trimmed)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add &quot;{trimmed}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
