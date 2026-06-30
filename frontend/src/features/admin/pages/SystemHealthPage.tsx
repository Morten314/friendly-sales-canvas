import { useSystemHealth } from "../hooks/useSystemHealth";

const COLOR: Record<string, string> = {
  ok: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  timeout: "bg-amber-100 text-amber-800",
};

export default function SystemHealthPage() {
  const { data, isLoading, isError, refetch, isFetching } = useSystemHealth();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">System Health</h1>
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Checking…" : "Refresh"}
        </button>
      </div>

      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to reach the health endpoint.</p>}
      {!isLoading && !isError && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.probes ?? []).map((p) => (
            <div key={p.name} className="flex items-center justify-between rounded border p-3">
              <span className="font-medium capitalize">{p.name}</span>
              <span className="flex items-center gap-2">
                {p.latency_ms != null && (
                  <span className="text-xs text-gray-500">{p.latency_ms} ms</span>
                )}
                <span
                  className={`rounded px-2 py-0.5 text-xs ${COLOR[p.status] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {p.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
      {data?.probes?.some((p) => p.status !== "ok") && (
        <div className="space-y-1 text-xs text-gray-600">
          {data.probes
            .filter((p) => p.detail)
            .map((p) => (
              <p key={p.name}>
                <span className="font-medium">{p.name}:</span> {p.detail}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
