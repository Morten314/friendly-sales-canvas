import { useState } from "react";

import { useCreateRegistration, useRegistrations } from "../hooks/useRegistrations";
import type { Registration } from "../types";

const PAGE_SIZE = 50;

function toCsv(rows: Registration[]): string {
  const esc = (v: string) => {
    const s = String(v ?? "");
    const needs = /[",\r\n]/.test(s) || /^[=+\-@]/.test(s); // RFC-4180 + formula guard
    const body = s.replace(/"/g, '""');
    return needs ? `"${/^[=+\-@]/.test(s) ? "'" + body : body}"` : body;
  };
  const header = ["id", "name", "email", "timestamp"];
  const lines = [header.join(",")];
  for (const r of rows) lines.push([r.id, r.name, r.email, r.timestamp].map(esc).join(","));
  return "﻿" + lines.join("\r\n");
}

export default function RegistrationsPage() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError } = useRegistrations(PAGE_SIZE, offset);
  const create = useCreateRegistration();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const rows = (data?.items ?? []) as Registration[];
  const total = data?.total ?? 0;

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${offset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Registrations</h1>

      <form
        className="flex flex-wrap items-end gap-2 rounded border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && email.trim())
            create.mutate(
              { name: name.trim(), email: email.trim() },
              {
                onSuccess: () => {
                  setName("");
                  setEmail("");
                },
              },
            );
        }}
      >
        <input
          className="rounded border px-2 py-1"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded border px-2 py-1"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="rounded bg-blue-600 px-3 py-1 text-white" disabled={create.isPending}>
          Add
        </button>
      </form>

      <div className="flex items-center gap-3">
        <button
          className="rounded border px-3 py-1"
          onClick={download}
          disabled={rows.length === 0}
        >
          Export CSV (this page)
        </button>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load registrations.</p>}
      {!isLoading && !isError && (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2">{r.email}</td>
                  <td className="py-2">{r.timestamp}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-gray-500">
                    No registrations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center gap-2">
            <button
              className="rounded border px-3 py-1"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Prev
            </button>
            <span className="text-sm">offset {offset}</span>
            <button
              className="rounded border px-3 py-1"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
