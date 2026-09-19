export type CsvRow = { date: string; description: string; amount: number };

/** Splits one CSV line, honouring double quotes. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const DATE_KEYS = ["date", "txn date", "transaction date", "value date"];
const DESC_KEYS = ["description", "narration", "details", "particulars", "remarks"];
const AMOUNT_KEYS = ["amount", "debit", "withdrawal", "withdrawal amt.", "dr"];

/** Accepts YYYY-MM-DD, DD/MM/YYYY and DD-MM-YYYY. Returns null when it is not a real date. */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.abs(Number(cleaned));
}

export type CsvParseResult = { rows: CsvRow[]; skipped: number; error?: string };

/** Parses a bank-statement CSV with date, description and amount columns. Rows that cannot be read are counted, not guessed. */
export function parseStatementCsv(text: string, maxRows = 500): CsvParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { rows: [], skipped: 0, error: "The file has no rows." };

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const find = (keys: string[]) => header.findIndex((h) => keys.includes(h));
  const [di, ni, ai] = [find(DATE_KEYS), find(DESC_KEYS), find(AMOUNT_KEYS)];
  if (di < 0 || ni < 0 || ai < 0) {
    return { rows: [], skipped: 0, error: "Could not find date, description and amount columns in the first row." };
  }

  const rows: CsvRow[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line);
    // A different cell count usually means an unquoted comma inside a value (for
    // example 1,234). Skipping is safer than reading a wrong amount.
    if (cells.length !== header.length) {
      skipped++;
      continue;
    }
    const date = normalizeDate(cells[di] ?? "");
    const amount = parseAmount(cells[ai] ?? "");
    const description = (cells[ni] ?? "").slice(0, 120);
    if (!date || amount === null || amount === 0 || !description) {
      skipped++;
      continue;
    }
    if (rows.length >= maxRows) {
      skipped++;
      continue;
    }
    rows.push({ date, description, amount });
  }
  return { rows, skipped };
}
