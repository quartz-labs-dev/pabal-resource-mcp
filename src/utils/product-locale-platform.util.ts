import type {
  AsoLocaleContent,
  ProductLocale,
  ProductLocalePlatform,
  ProductLocalePlatformLandingOverride,
  ProductLocalePlatformOverride,
} from "../types/products/index.js";

type LandingLocale = ProductLocale["landing"];

const mergeAso = (
  base: AsoLocaleContent | undefined,
  override: AsoLocaleContent | undefined
): AsoLocaleContent | undefined => {
  if (!override) return base;
  if (!base) return override;

  return {
    ...base,
    ...override,
    template:
      base.template || override.template
        ? { ...base.template, ...override.template }
        : undefined,
  } as AsoLocaleContent;
};

/**
 * `null` keeps the shared entry at that index, and the override's length wins
 * so a platform can drop entries the other store shows.
 */
const mergeOverrideList = <TBase, TOverride extends object>(
  base: TBase[] | undefined,
  override: (TOverride | null)[] | undefined
): TBase[] | undefined => {
  if (!override) return base;

  return override.map(
    (entry, index) => ({ ...base?.[index], ...entry }) as TBase
  );
};

const mergeLanding = (
  base: LandingLocale,
  override: ProductLocalePlatformLandingOverride | undefined
): LandingLocale => {
  if (!override) return base;

  return {
    ...base,
    hero:
      base?.hero || override.hero
        ? { ...base?.hero, ...override.hero }
        : undefined,
    reviews:
      base?.reviews || override.reviews
        ? { ...base?.reviews, ...override.reviews }
        : undefined,
    cta: base?.cta || override.cta ? { ...base?.cta, ...override.cta } : undefined,
    screenshots:
      base?.screenshots || override.screenshots
        ? {
            ...base?.screenshots,
            title: override.screenshots?.title ?? base?.screenshots?.title,
            images: mergeOverrideList(
              base?.screenshots?.images,
              override.screenshots?.images
            ),
          }
        : undefined,
    features:
      base?.features || override.features
        ? {
            ...base?.features,
            title: override.features?.title ?? base?.features?.title,
            items: mergeOverrideList(
              base?.features?.items,
              override.features?.items
            ),
          }
        : undefined,
  };
};

/**
 * Applies a locale file's per-store override on top of its shared copy.
 * Locales without a `platforms` block are returned untouched, so products that
 * ship identical copy to both stores need no migration.
 */
export function resolveProductLocaleForPlatform(
  localeData: ProductLocale | undefined,
  platform: ProductLocalePlatform
): ProductLocale {
  if (!localeData) return {};

  const override: ProductLocalePlatformOverride | undefined =
    localeData.platforms?.[platform];
  if (!override) return localeData;

  return {
    ...localeData,
    aso: mergeAso(localeData.aso, override.aso),
    landing: mergeLanding(localeData.landing, override.landing),
  };
}
