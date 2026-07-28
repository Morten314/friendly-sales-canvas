/**
 * Pure CSV/file helpers — no React, no component state.
 * Extracted from DataSourcesManager (Phase 13b, Seam 1).
 */

/**
 * RFC 4180 only treats U+0022 as the quote character. Excel/Word often emit "curly" quotes;
 * those must become ASCII " or multiline quoted fields never merge and column counts break.
 */
export const normalizeCsvAsciiDoubleQuotes = (text: string): string =>
  text.replace(/[“”„‟＂]/g, '"');

/** Split CSV into logical rows; newlines inside quoted fields do not end a row (RFC 4180). */
export const splitCsvIntoLogicalRows = (text: string): string[] => {
  if (!text) return [];
  const rows: string[] = [];
  let row = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        row += '"';
      }
    } else if (!inQuotes && (c === "\n" || (c === "\r" && next === "\n"))) {
      if (c === "\r") i++;
      rows.push(row);
      row = "";
    } else if (!inQuotes && c === "\r") {
      rows.push(row);
      row = "";
    } else {
      row += c;
    }
  }
  rows.push(row);
  return rows;
};

/**
 * Pick `,` vs `\t` vs `;` by how many rows match the header column count.
 * Header-only counting breaks when the first row is misleading or `\t` is regex-mishandled (tab files look like "spaces" in editors).
 */
export const detectDelimiter = (text: string): string => {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = splitCsvIntoLogicalRows(normalized).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return ",";

  const candidates: readonly string[] = [",", "\t", ";"];
  let best: string | null = null;
  let bestScore = -1;

  for (const delim of candidates) {
    const headerCount = parseCsvLineRelaxed(lines[0], delim).length;
    if (headerCount < 2) continue;

    let score = 0;
    const sample = Math.min(lines.length, 200);
    for (let i = 1; i < sample; i++) {
      if (parseCsvLineRelaxed(lines[i], delim).length === headerCount) score++;
    }

    if (
      best === null ||
      score > bestScore ||
      (score === bestScore && candidates.indexOf(delim) < candidates.indexOf(best))
    ) {
      bestScore = score;
      best = delim;
    }
  }

  if (best !== null && bestScore > 0) return best;

  // Fallback: raw separator counts on line 1 (no regex edge cases for \t)
  const first = lines[0];
  const commaC = (first.match(/,/g) || []).length;
  const tabC = (first.match(/\t/g) || []).length;
  const semiC = (first.match(/;/g) || []).length;
  const m = Math.max(commaC, tabC, semiC);
  if (m === 0) return ",";
  if (tabC === m) return "\t";
  if (semiC === m) return ";";
  return ",";
};

// Helper: Normalize column names
export const normalizeColumnNames = (headerLine: string): string => {
  const columnMapping: Record<string, string> = {
    fullname: "fullName",
    full_name: "fullName",
    FullName: "fullName",
    "Full Name": "fullName",
    "full name": "fullName",
    name: "fullName",
    Name: "fullName",
    email: "email",
    Email: "email",
    mobile: "mobile",
    Mobile: "mobile",
    phone: "mobile",
    Phone: "mobile",
    phone_number: "mobile",
    "Phone Number": "mobile",
    "phone number": "mobile",
    companyname: "companyName",
    company_name: "companyName",
    CompanyName: "companyName",
    "Company Name": "companyName",
    "company name": "companyName",
    company: "companyName",
    Company: "companyName",
    companywebsite: "companyWebsite",
    company_website: "companyWebsite",
    CompanyWebsite: "companyWebsite",
    "Company Website": "companyWebsite",
    "company website": "companyWebsite",
    website: "companyWebsite",
    Website: "companyWebsite",
    linkedinprofile: "linkedInProfile",
    linkedin_profile: "linkedInProfile",
    LinkedInProfile: "linkedInProfile",
    "LinkedIn Profile": "linkedInProfile",
    "linkedin profile": "linkedInProfile",
    linkedin: "linkedInProfile",
    LinkedIn: "linkedInProfile",
    actions: "actions",
    Actions: "actions",
    notes: "actions",
    Notes: "actions",
  };

  const columns = headerLine.split(",");
  const normalizedColumns = columns.map((col) => {
    const trimmed = col.trim();
    const lowerKey = trimmed.toLowerCase().replace(/\s+/g, "");
    const lowerWithSpaces = trimmed.toLowerCase();

    if (columnMapping[trimmed]) {
      return columnMapping[trimmed];
    } else if (columnMapping[lowerKey]) {
      return columnMapping[lowerKey];
    } else if (columnMapping[lowerWithSpaces]) {
      return columnMapping[lowerWithSpaces];
    } else if (columnMapping[trimmed.toLowerCase()]) {
      return columnMapping[trimmed.toLowerCase()];
    }
    return trimmed;
  });

  return normalizedColumns.join(",");
};

// Helper: Parse CSV line respecting quoted fields
export const parseCsvLine = (line: string, delimiter: string = ","): string[] => {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;

  // Handle empty line
  if (!line || line.trim().length === 0) {
    return [];
  }

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote (double quote)
        currentField += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        // Don't include the quote character in the field value
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator - push current field and start new one
      fields.push(currentField);
      currentField = "";
    } else {
      currentField += char;
    }
  }

  // Add the last field (even if line ends without delimiter)
  fields.push(currentField);

  // Handle trailing delimiter (creates empty field at end)
  if (line.endsWith(delimiter) && !inQuotes) {
    fields.push("");
  }

  return fields;
};

/** True if a line has an odd number of unescaped `"` toggles (unclosed quoted field on this line alone). */
export const csvLineHasUnclosedQuote = (line: string): boolean => {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    }
  }
  return inQuotes;
};

/**
 * Many exports use non-standard `\"` or omit the final `"` on a row. That swallows commas into one field
 * and collapses column counts. Repair before parsing.
 */
export const repairCsvLineForParsing = (line: string): string => {
  let s = line.replace(/\\"/g, '"');
  // No ASCII " in line → RFC quoting isn't in play; never append a synthetic closing quote.
  if (!s.includes('"')) return s;
  if (csvLineHasUnclosedQuote(s)) {
    s = `${s}"`;
  }
  return s;
};

export const parseCsvLineRelaxed = (line: string, delimiter: string = ","): string[] => {
  return parseCsvLine(repairCsvLineForParsing(line), delimiter);
};

// Helper: Normalize CSV format
export const normalizeCsv = (text: string): string => {
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = normalizeCsvAsciiDoubleQuotes(text);
  const delimiter = detectDelimiter(text);
  const lines = splitCsvIntoLogicalRows(text).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return text;

  // Normalize all lines to ensure consistent formatting
  const normalizedLines = lines.map((line) => {
    if (line.trim() === "") return line;

    // Parse the line using the detected delimiter
    const fields = parseCsvLineRelaxed(line, delimiter);

    // Ensure fields with special characters are properly quoted
    const normalizedFields = fields.map((field) => {
      const trimmedField = field.trim();
      // Quote fields that contain commas, quotes, or newlines
      if (
        trimmedField.includes(",") ||
        trimmedField.includes('"') ||
        trimmedField.includes("\n") ||
        trimmedField.includes("\r")
      ) {
        // Escape existing quotes by doubling them
        return `"${trimmedField.replace(/"/g, '""')}"`;
      }
      return trimmedField;
    });

    return normalizedFields.join(",");
  });

  text = normalizedLines.join("\n");

  // Normalize column names in header
  const finalLines = splitCsvIntoLogicalRows(text).filter((line) => line.trim().length > 0);
  if (finalLines.length > 0) {
    finalLines[0] = normalizeColumnNames(finalLines[0]);
    text = finalLines.join("\n");
  }

  return text;
};

// Helper: Check if file is binary (not a valid text file)
export const isBinaryFile = (arrayBuffer: ArrayBuffer): boolean => {
  const bytes = new Uint8Array(arrayBuffer);
  const maxBytesToCheck = Math.min(512, bytes.length);

  // Check for common binary file signatures
  // Excel files: PK (ZIP signature) at start
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return true; // ZIP/Excel file
  }

  // Check for high percentage of non-printable characters
  let nonPrintableCount = 0;
  for (let i = 0; i < maxBytesToCheck; i++) {
    const byte = bytes[i];
    // Allow common text characters: 0x09 (tab), 0x0A (LF), 0x0D (CR), 0x20-0x7E (printable ASCII)
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte > 0x7e) {
      nonPrintableCount++;
    }
  }

  // If more than 30% are non-printable, likely binary
  return nonPrintableCount / maxBytesToCheck > 0.3;
};

// Helper: Validate CSV format
export const validateCsvFormat = async (
  file: File,
): Promise<{ valid: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        // Use the same encoding detection as uploadCsvBatch
        const arrayBuffer = e.target?.result as ArrayBuffer;

        // Check if file is binary
        if (isBinaryFile(arrayBuffer)) {
          resolve({
            valid: false,
            error:
              "Invalid file format: This appears to be a binary file (possibly an Excel file). Please save your file as a CSV file before uploading. In Excel: File > Save As > CSV (Comma delimited) (*.csv)",
          });
          return;
        }

        const encodings = ["windows-1252", "iso-8859-1", "utf-8"];
        let text = "";
        let decoded = false;

        for (const encoding of encodings) {
          try {
            const decoder = new TextDecoder(encoding, { fatal: false });
            text = decoder.decode(arrayBuffer);
            decoded = true;
            break;
          } catch {
            continue;
          }
        }

        if (!decoded || !text) {
          text = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
        }

        // Remove BOM if present
        if (text.charCodeAt(0) === 0xfeff) {
          text = text.slice(1);
        }

        text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        text = normalizeCsvAsciiDoubleQuotes(text);

        // Check for binary content in decoded text
        // eslint-disable-next-line no-control-regex -- intentional: detecting control chars to identify binary uploads
        const binaryPattern = /[\x00-\x08\x0E-\x1F\x7F-\x9F]/g;
        const binaryMatches = text.substring(0, 1000).match(binaryPattern);
        if (binaryMatches && binaryMatches.length > 50) {
          resolve({
            valid: false,
            error:
              "Invalid file format: This file contains binary data and is not a valid CSV file. Please ensure you're uploading a plain text CSV file. If you're using Excel, save the file as 'CSV (Comma delimited) (*.csv)' format.",
          });
          return;
        }

        if (!text || text.trim().length === 0) {
          resolve({ valid: false, error: "CSV file is empty" });
          return;
        }

        // First, validate the original file structure (respect quoted fields that span lines)
        const originalLines = splitCsvIntoLogicalRows(text).filter(
          (line) => line.trim().length > 0,
        );
        if (originalLines.length === 0) {
          resolve({ valid: false, error: "CSV file appears to be empty" });
          return;
        }

        // Detect delimiter from original file
        const originalDelimiter = detectDelimiter(text);

        // Validate original structure
        const originalHeaderFields = parseCsvLineRelaxed(originalLines[0], originalDelimiter);
        const originalExpectedCount = originalHeaderFields.length;

        if (originalExpectedCount === 0) {
          resolve({ valid: false, error: "CSV header is empty or invalid" });
          return;
        }

        // Check original file structure (scan all rows — "line 70" is logical row index, not always your editor line)
        type BadRow = { rowNum: number; actual: number; line: string; unclosed: boolean };
        const badOriginal: BadRow[] = [];
        for (let i = 1; i < originalLines.length; i++) {
          const line = originalLines[i];

          // eslint-disable-next-line no-control-regex -- intentional: detecting control chars to identify binary uploads
          const binaryPatternRow = /[\x00-\x08\x0E-\x1F\x7F-\x9F]/;
          if (binaryPatternRow.test(line)) {
            console.error("❌ CSV Validation Error - Binary content detected:", {
              lineNumber: i + 1,
              linePreview: line.substring(0, 100),
            });
            resolve({
              valid: false,
              error: `Invalid file format detected on row ${i + 1} (data rows after header): This file appears to be a binary file (possibly an Excel .xlsx file) rather than a CSV file. Please save your file as CSV format: In Excel, go to File > Save As > Choose "CSV (Comma delimited) (*.csv)" format.`,
            });
            return;
          }

          const rowFields = parseCsvLineRelaxed(line, originalDelimiter);
          if (rowFields.length !== originalExpectedCount) {
            const repaired = repairCsvLineForParsing(line);
            badOriginal.push({
              rowNum: i + 1,
              actual: rowFields.length,
              line,
              unclosed: csvLineHasUnclosedQuote(repaired),
            });
          }
        }

        if (badOriginal.length > 0) {
          const first = badOriginal[0];
          const examples = badOriginal
            .slice(0, 8)
            .map((b) => `row ${b.rowNum} (${b.actual} columns)`)
            .join(", ");
          const more = badOriginal.length > 8 ? ` (+${badOriginal.length - 8} more)` : "";
          console.error("❌ CSV Validation Error (Original):", {
            badRowCount: badOriginal.length,
            expectedColumns: originalExpectedCount,
            delimiter: originalDelimiter,
            examples: badOriginal.slice(0, 5).map((b) => ({
              rowNum: b.rowNum,
              actualColumns: b.actual,
              linePreview: b.line.substring(0, 200),
            })),
          });

          const tip =
            "Row numbers count logical CSV rows (header is row 1); blank lines are skipped, and one spreadsheet row split across several lines counts as a single row—so they often do not match line numbers in VS Code. ";
          if (badOriginal.some((b) => b.unclosed)) {
            resolve({
              valid: false,
              error: `${tip}Problem rows include: ${examples}${more}. At least one row has a quoted field that is not closed (missing "). Fix those cells or re-export from Excel/Sheets as CSV.`,
            });
            return;
          }
          resolve({
            valid: false,
            error: `${tip}Problem rows include: ${examples}${more}. Expected ${originalExpectedCount} columns per row (from the header). Often this is tabs vs commas—save as "CSV (Comma delimited)" from Excel, or ensure every row uses the same separator. First problem preview: "${first.line.substring(0, 120).replace(/\s+/g, " ")}"`,
          });
          return;
        }

        // Now validate after normalization (what will be sent to backend)
        const normalizedText = normalizeCsv(text);
        const normalizedLines = splitCsvIntoLogicalRows(normalizedText).filter(
          (line) => line.trim().length > 0,
        );

        if (normalizedLines.length === 0) {
          resolve({ valid: false, error: "CSV file appears to be empty after normalization" });
          return;
        }

        // Use comma as delimiter after normalization
        const delimiter = ",";

        // Parse normalized header
        const headerFields = parseCsvLineRelaxed(normalizedLines[0], delimiter);
        const expectedColumnCount = headerFields.length;

        console.log("🔍 CSV Validation - Normalized Header:", {
          headerLine: normalizedLines[0],
          headerFields,
          expectedColumnCount,
        });

        if (expectedColumnCount === 0) {
          resolve({ valid: false, error: "CSV header is empty or invalid after normalization" });
          return;
        }

        const badNormalized: BadRow[] = [];
        for (let i = 1; i < normalizedLines.length; i++) {
          const normLine = normalizedLines[i];
          const rowFields = parseCsvLineRelaxed(normLine, delimiter);
          if (rowFields.length !== expectedColumnCount) {
            const repaired = repairCsvLineForParsing(normLine);
            badNormalized.push({
              rowNum: i + 1,
              actual: rowFields.length,
              line: normLine,
              unclosed: csvLineHasUnclosedQuote(repaired),
            });
          }
        }

        if (badNormalized.length > 0) {
          const first = badNormalized[0];
          const examples = badNormalized
            .slice(0, 8)
            .map((b) => `row ${b.rowNum} (${b.actual} columns)`)
            .join(", ");
          const more = badNormalized.length > 8 ? ` (+${badNormalized.length - 8} more)` : "";
          console.error("❌ CSV Validation Error (Normalized):", {
            badRowCount: badNormalized.length,
            expectedColumns: expectedColumnCount,
            examples: badNormalized.slice(0, 3),
          });
          const tip =
            "After normalizing for upload, some rows still do not match the header. Row numbers are logical rows (header = 1), not always VS Code line numbers. ";
          if (badNormalized.some((b) => b.unclosed)) {
            resolve({
              valid: false,
              error: `${tip}Problem rows: ${examples}${more}. Fix unclosed quotes (") in those cells or re-export the CSV from Excel.`,
            });
            return;
          }
          resolve({
            valid: false,
            error: `${tip}Problem rows: ${examples}${more}. Expected ${expectedColumnCount} columns. Preview: "${first.line.substring(0, 120).replace(/\s+/g, " ")}"`,
          });
          return;
        }

        console.log(
          "✅ CSV Validation - All rows validated successfully (original and normalized)",
        );

        resolve({ valid: true });
      } catch (error) {
        resolve({
          valid: false,
          error: `Failed to read CSV file: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    };

    reader.onerror = () => resolve({ valid: false, error: "Failed to read file" });
    // Read as ArrayBuffer to match uploadCsvBatch encoding detection
    reader.readAsArrayBuffer(file);
  });
};

// Helper: Parse error messages
export const parseErrorMessage = (errorMessage: string): string => {
  // Extract error message from JSON format if present
  let cleanMessage = errorMessage;
  try {
    const jsonMatch = errorMessage.match(/\{"detail":\s*"([^"]+)"\}/);
    if (jsonMatch) {
      cleanMessage = jsonMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
  } catch {
    // If parsing fails, use original message
  }

  // Check for CSV format errors
  if (cleanMessage.includes("Expected") && cleanMessage.includes("fields")) {
    const match = cleanMessage.match(/Expected (\d+) fields? in line (\d+), saw (\d+)/);
    if (match) {
      const [, expected, lineNum, actual] = match;
      return `CSV format error on line ${lineNum}: Expected ${expected} column(s), but found ${actual}. Please ensure all rows have the same number of columns and that fields containing commas are enclosed in quotes.`;
    }

    // Alternative pattern
    const match2 = cleanMessage.match(/Expected (\d+) fields? in line (\d+), saw (\d+)/);
    if (match2) {
      const [, expected, lineNum, actual] = match2;
      return `CSV format error on line ${lineNum}: Expected ${expected} column(s), but found ${actual}. Please ensure all rows have the same number of columns and that fields containing commas are enclosed in quotes.`;
    }
  }

  if (cleanMessage.includes("tokenizing data")) {
    return `CSV parsing error: ${cleanMessage}. Please check that your CSV file uses commas as delimiters and that fields with commas or special characters are enclosed in double quotes.`;
  }

  if (cleanMessage.includes("codec") || cleanMessage.includes("decode")) {
    return `File encoding error: ${cleanMessage}. The file has been converted to UTF-8, but please try saving your CSV file as UTF-8 format before uploading.`;
  }

  // Remove status code prefix if present
  const statusMatch = cleanMessage.match(/^\d+\s*-\s*(.+)$/);
  if (statusMatch) {
    cleanMessage = statusMatch[1];
  }

  return cleanMessage;
};

/**
 * Backend accepts CSV text and Excel binaries. Browsers often omit extensions or set only MIME;
 * extension-only checks misclassify XLSX as CSV and run convertToUtf8 (corrupts ZIP/OLE bytes).
 */
export const getLeadImportKind = (file: File): "csv" | "excel" | null => {
  if (/\.(xlsx|xls|xlsm)$/i.test(file.name)) return "excel";
  if (/\.csv$/i.test(file.name)) return "csv";
  const t = (file.type || "").toLowerCase();
  if (
    t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    t === "application/vnd.ms-excel" ||
    t === "application/vnd.ms-excel.sheet.macroenabled.12" ||
    (t.includes("spreadsheetml") && !t.includes("csv"))
  ) {
    return "excel";
  }
  if (t === "text/csv" || t === "application/csv") return "csv";
  return null;
};

export const sniffExcelBinarySignature = async (f: File): Promise<boolean> => {
  if (f.size < 4) return false;
  const ab = await f.slice(0, 8).arrayBuffer();
  const u = new Uint8Array(ab);
  if (u.length >= 2 && u[0] === 0x50 && u[1] === 0x4b) return true;
  if (u.length >= 4 && u[0] === 0xd0 && u[1] === 0xcf && u[2] === 0x11 && u[3] === 0xe0)
    return true;
  return false;
};
