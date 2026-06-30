import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAdminOrgs } from "../hooks/useAdminOrgs";
import { useConnectUserToOrg, useCreateOrg, useOrgByUser } from "../hooks/useOrgActions";

export default function TenantsOverviewPage() {
  const { data: orgs, isLoading, isError } = useAdminOrgs();
  const [search, setSearch] = useState("");

  const createOrg = useCreateOrg();
  const connect = useConnectUserToOrg();
  const [newOrgName, setNewOrgName] = useState("");
  const [connUser, setConnUser] = useState("");
  const [connOrg, setConnOrg] = useState("");
  const [lookupUser, setLookupUser] = useState("");
  const [lookupActive, setLookupActive] = useState(false);
  const lookup = useOrgByUser(lookupUser, lookupActive);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs ?? [];
    return (orgs ?? []).filter(
      (o) => (o.org_name ?? "").toLowerCase().includes(q) || o.org_id.toLowerCase().includes(q),
    );
  }, [orgs, search]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tenants</h1>

      <section className="grid gap-4 md:grid-cols-3">
        <form
          className="space-y-2 rounded border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newOrgName.trim())
              createOrg.mutate(newOrgName.trim(), { onSuccess: () => setNewOrgName("") });
          }}
        >
          <p className="font-medium">New org</p>
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="Org name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
          />
          <button
            className="rounded bg-blue-600 px-3 py-1 text-white"
            disabled={createOrg.isPending}
          >
            Create
          </button>
          {createOrg.data?.org_id && (
            <p className="text-xs text-green-700">Created {createOrg.data.org_id}</p>
          )}
        </form>

        <form
          className="space-y-2 rounded border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (connUser.trim() && connOrg.trim())
              connect.mutate({ userId: connUser.trim(), orgId: connOrg.trim() });
          }}
        >
          <p className="font-medium">Connect user → org</p>
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="user_id"
            value={connUser}
            onChange={(e) => setConnUser(e.target.value)}
          />
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="org_id"
            value={connOrg}
            onChange={(e) => setConnOrg(e.target.value)}
          />
          <button className="rounded bg-blue-600 px-3 py-1 text-white" disabled={connect.isPending}>
            Connect
          </button>
          {connect.isSuccess && <p className="text-xs text-green-700">Connected</p>}
        </form>

        <form
          className="space-y-2 rounded border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setLookupActive(true);
          }}
        >
          <p className="font-medium">Look up org by user</p>
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="user_id"
            value={lookupUser}
            onChange={(e) => {
              setLookupUser(e.target.value);
              setLookupActive(false);
            }}
          />
          <button className="rounded bg-blue-600 px-3 py-1 text-white">Look up</button>
          {lookupActive && lookup.data?.org_id && (
            <p className="text-xs">
              org_id: {lookup.data.org_id}
              {lookup.data.org_name ? ` (${lookup.data.org_name})` : ""}
            </p>
          )}
          {lookupActive && lookup.isError && <p className="text-xs text-red-600">No org found</p>}
        </form>
      </section>

      <input
        className="w-full max-w-sm rounded border px-3 py-2"
        placeholder="Search orgs…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load orgs.</p>}
      {!isLoading && !isError && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Org</th>
              <th className="py-2">org_id</th>
              <th className="py-2">Users</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.org_id} className="border-b hover:bg-gray-50">
                <td className="py-2">
                  <Link
                    className="text-blue-600 hover:underline"
                    to={`/admin/tenants/${encodeURIComponent(o.org_id)}`}
                  >
                    {o.org_name ?? "(unnamed)"}
                  </Link>
                </td>
                <td className="py-2 font-mono text-xs">{o.org_id}</td>
                <td className="py-2">{o.user_count}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="py-3 text-gray-500" colSpan={3}>
                  No orgs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
