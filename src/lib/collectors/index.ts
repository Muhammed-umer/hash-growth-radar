import type { Platform } from "../types";
import { collectYouTube } from "./youtube";
import type { Collector } from "./types";

export { CollectorConfigError } from "./types";
export type { Collector, CollectorResult, CollectorContext } from "./types";

/** Platforms with an automatic collector. */
export const COLLECTORS: Partial<Record<Platform, Collector>> = {
  youtube: collectYouTube,
};
