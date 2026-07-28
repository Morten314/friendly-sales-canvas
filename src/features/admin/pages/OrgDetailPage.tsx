import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAdminOrgs } from "../hooks/useAdminOrgs";
import {
  useCompanyProfile,
  useCustomerProfiles,
  useOrgLeads,
  useUserDocuments,
} from "../hooks/useOrgInspection";

type Tab = "company" | "customers" | "leads" | "documents";

function JsonPanel({
  isLoading,
  isError,
  data,
}: {
  isLoading: boolean;
  isError: boolean;
  data: unknown;
}) {
  if (isLoading) return <p>Loading…</p>;
  if (isError) return <p className="text-red-600">Failed to load.</p>;
  return (
    <pre className="max-h-[60vh] overflow-auto rounded bg-gray-50 p-3 text-xs">
      {JSON.stringify(data ?? null, null, 2)}
    </pre>
  );
}

export default function OrgDetailPage() {
  const { orgId = "" } = useParams();
  const [tab, setTab] = useState<Tab>("company");

  const { data: orgs } = useAdminOrgs();
  const org = (orgs ?? []).find((o) => o.org_id === orgId);

  const company = useCompanyProfile(orgId);
  const customers = useCustomerProfiles(orgId);
  const leads = useOrgLeads(orgId);
  const documents = useUserDocuments(orgId);

  const tabs: { key: Tab; label: string }[] = [
    { key: "company", label: "Company Profile" },
    { key: "customers", label: "Customer Profiles" },
    { key: "leads", label: "Leads" },
    { key: "documents", label: "Documents" },
  ];
  const active = { company, customers, leads, documents }[tab];

  return (
    <div className="space-y-4">
      <Link to="/admin/tenants" className="text-sm text-blue-600 hover:underline">
        ← All tenants
      </Link>
      <h1 className="text-2xl font-semibold">{org?.org_name ?? "(unnamed org)"}</h1>
      <p className="font-mono text-xs text-gray-500">{orgId}</p>
      {org && org.user_ids.length > 0 && (
        <p className="text-xs text-gray-500">Users: {org.user_ids.join(", ")}</p>
      )}

      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm ${tab === t.key ? "border-b-2 border-blue-600 font-medium" : "text-gray-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <JsonPanel isLoading={active.isLoading} isError={active.isError} data={active.data} />
    </div>
  );
}
