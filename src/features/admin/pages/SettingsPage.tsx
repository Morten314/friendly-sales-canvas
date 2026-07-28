import { useEffect, useState } from "react";

import { useAppSettings, useUpdateAppSettings } from "../hooks/useAppSettings";
import type { AppSettings } from "../types";

// Editable settings, in display order. Bounds mirror the backend AppSettings
// Field() bounds; each value is edited as a string and parsed/validated before
// save. The PUT sends the FULL object — a partial PUT would reset the omitted
// fields to their backend defaults (see test_settings_endpoints).
const FIELDS: { key: keyof AppSettings; label: string; help: string; min: number; max: number }[] =
  [
    {
      key: "lead_fetch_limit",
      label: "Lead fetch limit",
      help: "Max leads fed into signal matching & generation per run.",
      min: 1,
      max: 500,
    },
    {
      key: "signal_lead_map_lead_limit",
      label: "Matched-leads · lead cap",
      help: "Max newest leads the matched-leads map covers (capped at the lead fetch limit). Fewer = faster.",
      min: 1,
      max: 500,
    },
    {
      key: "signal_lead_map_batch_size",
      label: "Matched-leads · batch size",
      help: "Leads per Claude call. Smaller = faster, non-truncating outputs.",
      min: 1,
      max: 100,
    },
  ];

export default function SettingsPage() {
  const { data, isLoading, isError } = useAppSettings();
  const update = useUpdateAppSettings();
  const [values, setValues] = useState<Record<string, string>>({});

  // Seed inputs from the loaded settings (and re-seed after a successful save,
  // when the invalidated query refetches).
  useEffect(() => {
    if (data) setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(data[f.key])])));
  }, [data]);

  const fields = FIELDS.map((f) => {
    const raw = values[f.key] ?? "";
    const n = Number(raw);
    const valid = raw !== "" && Number.isInteger(n) && n >= f.min && n <= f.max;
    const changed = data != null && n !== data[f.key];
    return { ...f, raw, n, valid, changed };
  });
  const allValid = fields.every((f) => f.valid);
  const anyChanged = fields.some((f) => f.changed);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load settings.</p>}

      {!isLoading && !isError && (
        <form
          className="max-w-md space-y-4 rounded border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!allValid || !anyChanged) return;
            update.mutate({
              lead_fetch_limit: Number(values.lead_fetch_limit),
              signal_lead_map_lead_limit: Number(values.signal_lead_map_lead_limit),
              signal_lead_map_batch_size: Number(values.signal_lead_map_batch_size),
            });
          }}
        >
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="block text-sm font-medium" htmlFor={f.key}>
                {f.label}
              </label>
              <p className="text-xs text-gray-500">
                {f.help} ({f.min}–{f.max})
              </p>
              <input
                id={f.key}
                type="number"
                min={f.min}
                max={f.max}
                className="w-32 rounded border px-2 py-1"
                value={f.raw}
                onChange={(e) => {
                  const v = e.target.value;
                  setValues((prev) => ({ ...prev, [f.key]: v }));
                  // Editing after a save/failure clears the stale result banner.
                  if (update.isSuccess || update.isError) update.reset();
                }}
              />
              {f.raw !== "" && !f.valid && (
                <p className="text-sm text-red-600">
                  Enter a whole number between {f.min} and {f.max}.
                </p>
              )}
            </div>
          ))}
          <div>
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
              disabled={!allValid || !anyChanged || update.isPending}
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
          {update.isSuccess && <p className="text-sm text-green-600">Saved.</p>}
          {update.isError && <p className="text-sm text-red-600">Failed to save.</p>}
        </form>
      )}
    </div>
  );
}
