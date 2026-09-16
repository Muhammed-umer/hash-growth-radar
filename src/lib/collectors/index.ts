import type { Platform } from "../types";
import { collectReddit } from "./reddit";
import { collectYouTube } from "./youtube";
import type { Collector } from "./types";

export { CollectorConfigError } from "./types";
export type { Collector, CollectorResult, CollectorContext } from "./types";

/** Platforms with an automatic collector. Everything else is manual intake. */
export const COLLECTORS: Partial<Record<Platform, Collector>> = {
  youtube: collectYouTube,
  reddit: collectReddit,
};
