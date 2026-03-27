/**
 * Browser-friendly entry point
 *
 * Exposes types, constants, and locale converters without pulling in
 * Node-only modules like fs/path/os so bundlers can safely include this
 * package in client builds.
 */

// Types
export * from "./types/aso/index.js";
export * from "./types/blog.types.js";
export * from "./types/products/index.js";
export * from "./types/site.types.js";
export * from "./types/tools/index.js";

// Constants
export {
  UNIFIED_LOCALES,
  DEFAULT_LOCALE,
  UNIFIED_TO_APP_STORE,
  UNIFIED_TO_GOOGLE_PLAY,
  APP_STORE_TO_UNIFIED,
  GOOGLE_PLAY_TO_UNIFIED,
  type UnifiedLocale,
} from "./constants/unified-locales.js";
export {
  DEFAULT_APP_SLUG,
  DEVELOPER_JOURNAL_APP_SLUG,
  DEVELOPER_TECH_APP_SLUG,
  isDeveloperBlogAppSlug,
} from "./constants/blog.constants.js";

// Utils (browser-safe)
export * from "./utils/locale-converter.js";
