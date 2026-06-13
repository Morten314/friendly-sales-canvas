/**
 * Pure data-source helpers — no React, no component state.
 * Extracted from DataSourcesManager (Phase 13b, Seam 2).
 */

import type { DataSource, DataSourceType } from "../../types";

// Extract file_id UUID from file_key (which is in format: {user_id}/{uuid}_{filename})
export const extractFileIdFromFileKey = (fileKey: string): string => {
  if (!fileKey) {
    console.warn("⚠️ extractFileIdFromFileKey: fileKey is empty");
    return fileKey;
  }

  console.log("🔍 extractFileIdFromFileKey - Input:", fileKey);

  // If file_key contains a slash, extract the part after it
  if (fileKey.includes("/")) {
    const parts = fileKey.split("/");
    const afterSlash = parts[parts.length - 1]; // Get the last part after the slash
    console.log("🔍 extractFileIdFromFileKey - After slash:", afterSlash);

    // Extract UUID (36 characters with hyphens) before the first underscore
    const uuidMatch = afterSlash.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    if (uuidMatch && uuidMatch[1]) {
      console.log("✅ extractFileIdFromFileKey - Extracted UUID via regex:", uuidMatch[1]);
      return uuidMatch[1];
    }

    // If no UUID pattern found, try to extract just the part before the first underscore
    const beforeUnderscore = afterSlash.split("_")[0];
    console.log("🔍 extractFileIdFromFileKey - Before underscore:", beforeUnderscore);

    // Check if it looks like a UUID (36 chars with hyphens)
    if (beforeUnderscore.length === 36 && beforeUnderscore.includes("-")) {
      // Validate it's actually a UUID format
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(beforeUnderscore)) {
        console.log(
          "✅ extractFileIdFromFileKey - Extracted UUID before underscore:",
          beforeUnderscore,
        );
        return beforeUnderscore;
      }
    }
  }

  // If no slash, check if the whole string is a UUID
  const uuidMatch = fileKey.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  if (uuidMatch && uuidMatch[1]) {
    console.log("✅ extractFileIdFromFileKey - Whole string is UUID:", uuidMatch[1]);
    return uuidMatch[1];
  }

  // Fallback: return the original fileKey if we can't extract UUID
  console.warn(
    "⚠️ extractFileIdFromFileKey - Could not extract UUID, returning original:",
    fileKey,
  );
  return fileKey;
};

/** file_key path for GET /document-status — never a stale merged UI id. */
export const resolveDocumentStatusFileKey = (source: DataSource): string =>
  source.type === "file" ? (source.fileKey ?? source.id) : source.id;

/** Encode each path segment so spaces and special chars in filenames survive fetch. */
export const encodeFileKeyForStatusUrl = (fileKey: string): string =>
  fileKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

/** Keep a local-only row during sync only while it is still uploading/processing. */
export const isPendingLocalDataSource = (source: DataSource): boolean =>
  source.status === "processing";

/** Only merge by fileName when both rows are the same backend object. */
export const shouldMergeFileByFileName = (existing: DataSource, backend: DataSource): boolean => {
  if (!backend.fileName || existing.fileName !== backend.fileName) return false;
  if (backend.fileId && existing.fileId) {
    return backend.fileId === existing.fileId;
  }
  const backendKey = backend.fileKey ?? backend.id;
  if (existing.fileKey && existing.fileKey === backendKey) return true;
  return existing.id === backend.id;
};

/** Update the row that corresponds to a polled file (fileId is authoritative). */
export const isSameDataSourceRow = (row: DataSource, target: DataSource): boolean => {
  if (target.fileId && row.fileId && row.fileId === target.fileId) return true;
  return row.id === target.id;
};

export const getTypeLabel = (type: DataSourceType) => {
  switch (type) {
    case "url":
      return "URL";
    case "file":
      return "File";
    case "system":
      return "System";
  }
};
