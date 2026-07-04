import { useEffect, useState } from "react";

import { useAppSettings, useUpdateAppSettings } from "../hooks/useAppSettings";

const MIN = 1;
const MAX = 500;

export default function SettingsPage() {
  const { data, isLoading, isError } = useAppSettings();
  const update = useUpdateAppSettings();
  const [value, setValue] = useState("");

  // Seed the input from the loaded value (and re-seed after a successful save,
  // when the invalidated query refetches).
  useEffect(() => {
    if (data) setValue(String(data.lead_fetch_limit));
  }, [data]);

  const parsed = Number(value);
  const valid = value !== "" && Number.isInteger(parsed) && parsed >= MIN && parsed <= MAX;
  const unchanged = data != null && parsed === data.lead_fetch_limit;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load settings.</p>}

      {!isLoading && !isError && (
        <form
          className="max-w-md space-y-3 rounded border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !unchanged) update.mutate({ lead_fetch_limit: parsed });
          }}
        >
          <label className="block text-sm font-medium" htmlFor="lead-fetch-limit">
            Lead fetch limit
          </label>
          <p className="text-xs text-gray-500">
            Max leads fed into signal matching &amp; generation per run ({MIN}–{MAX}).
          </p>
          <input
            id="lead-fetch-limit"
            type="number"
            min={MIN}
            max={MAX}
            className="w-32 rounded border px-2 py-1"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              // Editing after a save/failure clears the stale result banner.
              if (update.isSuccess || update.isError) update.reset();
            }}
          />
          {value !== "" && !valid && (
            <p className="text-sm text-red-600">
              Enter a whole number between {MIN} and {MAX}.
            </p>
          )}
          <div>
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
              disabled={!valid || unchanged || update.isPending}
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
