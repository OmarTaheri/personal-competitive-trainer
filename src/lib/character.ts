export type GroupMastery = { group: string; score: number | null; attempts: number; status: "strong" | "learning" | "weak" | "new"; weakest?: string | null };

/** You start with nothing: every piece of gear is earned by levelling up. */
export const UNLOCKS = [
  { level: 2, item: "T-shirt" },
  { level: 3, item: "Joggers" },
  { level: 4, item: "Sneakers" },
  { level: 5, item: "Orange headband" },
  { level: 7, item: "Green wristband" },
  { level: 10, item: "Training hoodie" },
  { level: 15, item: "Headphones" },
  { level: 20, item: "Green aura" },
  { level: 25, item: "Laptop" },
  { level: 30, item: "Golden sneakers" },
];
