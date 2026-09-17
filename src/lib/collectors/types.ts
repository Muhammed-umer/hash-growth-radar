import type { Config } from "../config";
import type { RawItem } from "../types";

export interface CollectorContext {
  config: Config;
  now: Date;
}

export interface CollectorResult {
  items: RawItem[];
  /** Small numbers worth showing on the platform page (searches used, videos scanned, ...). */
  notes: Record<string, unknown>;
  /**
   * Saves the collector's own progress (e.g. comment cursors). The pipeline
   * calls it only after `items` are stored, so progress never runs ahead of
   * the data. If storing fails, it is not called and the next run re-reads.
   */
  commit?: () => Promise<void>;
}

export type Collector = (ctx: CollectorContext) => Promise<CollectorResult>;

/**
 * Thrown when a collector cannot run for a configuration reason (missing key,
 * feature disabled). The run is recorded as "skipped", not "error".
 */
export class CollectorConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectorConfigError";
  }
}
