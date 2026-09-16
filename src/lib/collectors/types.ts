import type { SettingsShape } from "../config";
import type { RawItem } from "../types";

export interface CollectorContext {
  settings: SettingsShape;
  now: Date;
}

export interface CollectorResult {
  items: RawItem[];
  /** Small numbers worth showing on the platform page (searches used, videos scanned, ...). */
  notes: Record<string, unknown>;
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
