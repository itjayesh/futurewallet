export const CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Rent & EMI",
  "Entertainment",
  "Health",
  "Education",
  "Travel",
  "Subscriptions",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Categories treated as discretionary for impulse-control scoring and suggested cuts. */
export const DISCRETIONARY: readonly Category[] = [
  "Food & Dining",
  "Shopping",
  "Entertainment",
  "Travel",
  "Subscriptions",
];

/** Assumed annual return shown to the user. An assumption, not a promise. */
export const ANNUAL_RETURN = 0.07;

/** Late-night cutoff for impulse-control scoring (24h clock, inclusive). */
export const LATE_NIGHT_HOUR = 23;

export const DAYS_PER_MONTH = 30.4375;
