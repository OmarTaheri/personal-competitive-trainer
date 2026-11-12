export type ContestUpsert = {
  platform: string;
  externalId: string;
  name: string;
  startUtc: number; // ms
  durationSec: number;
  url: string;
};

export type SolvesResult = { solved: number; newlyMarked: number; rating?: number | null; note?: string };

/** One interface for every judge. Not every platform supports every method. */
export interface PlatformAdapter {
  platform: string;
  fetchProblems?(): Promise<number>;
  fetchSolves?(handle: string): Promise<SolvesResult>;
  fetchContests?(): Promise<ContestUpsert[]>;
  /** Problems of a finished contest the user joined, with whether the user solved each. */
  fetchContestProblems?(contest: { externalId: string; url: string }, handle: string | null): Promise<{ problemId: number; solved: boolean }[]>;
}
