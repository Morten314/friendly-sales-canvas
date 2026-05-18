import type { SEP } from "./sepTypes";

const KEY = "strategistSEPs";

const listeners = new Set<() => void>();

const read = (): SEP[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SEP[];
  } catch {
    return [];
  }
};

const write = (seps: SEP[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(seps));
  } catch {
    // ignore quota
  }
  listeners.forEach((l) => l());
};

export const listSEPs = (): SEP[] =>
  read().sort(
    (a, b) =>
      new Date(b.manifest.generatedAt).getTime() -
      new Date(a.manifest.generatedAt).getTime(),
  );

export const getSEP = (id: string): SEP | undefined =>
  read().find((s) => s.manifest.id === id);

export const saveSEP = (sep: SEP) => {
  const existing = read();
  if (existing.some((s) => s.manifest.id === sep.manifest.id)) return;
  write([...existing, sep]);
};

export const nextVersion = (): number => {
  const seps = read();
  if (!seps.length) return 1;
  return Math.max(...seps.map((s) => s.manifest.version)) + 1;
};

export const latestApproved = (): SEP | undefined =>
  listSEPs().find((s) => s.manifest.status === "approved");

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};