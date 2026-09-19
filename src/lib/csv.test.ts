import { describe, expect, it } from "vitest";
import { normalizeDate, parseStatementCsv } from "./csv";

describe("normalizeDate", () => {
  it("accepts the common bank formats", () => {
    expect(normalizeDate("2026-09-05")).toBe("2026-09-05");
    expect(normalizeDate("05/09/2026")).toBe("2026-09-05");
    expect(normalizeDate("5-9-2026")).toBe("2026-09-05");
  });
  it("rejects impossible dates", () => {
    expect(normalizeDate("31/02/2026")).toBeNull();
    expect(normalizeDate("yesterday")).toBeNull();
  });
});

describe("parseStatementCsv", () => {
  const csv = [
    "Date,Description,Amount",
    "05/09/2026,ZOMATO ORDER 8841,₹450.00",
    '06/09/2026,"UBER INDIA, BLR",1,234',
    '07/09/2026,"UBER INDIA, BLR","1,234.50"',
    "31/02/2026,BAD DATE,100",
    "08/09/2026,,100",
    "09/09/2026,REFUND,abc",
  ].join("\n");

  it("reads valid rows and counts the ones it cannot read", () => {
    const r = parseStatementCsv(csv);
    expect(r.rows).toEqual([
      { date: "2026-09-05", description: "ZOMATO ORDER 8841", amount: 450 },
      { date: "2026-09-07", description: "UBER INDIA, BLR", amount: 1234.5 },
    ]);
    // Skipped: the unquoted 1,234 row (extra cell), the impossible date, the empty description, the non-numeric amount.
    expect(r.skipped).toBe(4);
  });

  it("uses the absolute value for debits written as negatives", () => {
    const r = parseStatementCsv("Date,Narration,Debit\n2026-09-05,SWIGGY,-320");
    expect(r.rows[0].amount).toBe(320);
  });

  it("explains a file without the needed columns", () => {
    const r = parseStatementCsv("a,b,c\n1,2,3");
    expect(r.error).toMatch(/columns/);
    expect(r.rows).toHaveLength(0);
  });

  it("caps the number of rows", () => {
    const lines = ["Date,Description,Amount", ...Array.from({ length: 10 }, (_, i) => `2026-09-0${(i % 9) + 1},M${i},10`)];
    const r = parseStatementCsv(lines.join("\n"), 4);
    expect(r.rows).toHaveLength(4);
    expect(r.skipped).toBe(6);
  });
});
