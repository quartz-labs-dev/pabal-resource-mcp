/**
 * icon-specs: Icon specification definitions for different platforms
 */

export interface IconSpec {
  filename: string;
  size: number;
  safeZoneRadius?: number; // Virtual circle radius that icon should fit within
  description: string;
}

/**
 * Icon filename constants
 */
export const ICON_FILENAMES = {
  BASE: "icon.png",
  IOS_LIGHT: "ios-light.png",
  ADAPTIVE_ICON: "adaptive-icon.png",
  SPLASH_ICON_LIGHT: "splash-icon-light.png",
  ANDROID_NOTIFICATION: "android-notification-icon.png",
} as const;

/**
 * App icon specifications for different platforms
 */
export const ICON_SPECS: Record<string, IconSpec> = {
  "ios-light": {
    filename: ICON_FILENAMES.IOS_LIGHT,
    size: 1024,
    safeZoneRadius: 445, // 890px diameter = 445px radius
    description: "iOS app icon (1024x1024, logo fits within 890px circle)",
  },
  "adaptive-icon": {
    filename: ICON_FILENAMES.ADAPTIVE_ICON,
    size: 1024,
    safeZoneRadius: 237.5, // 475px diameter = 237.5px radius
    description:
      "Android adaptive icon (1024x1024, logo fits within 475px circle)",
  },
  "splash-icon-light": {
    filename: ICON_FILENAMES.SPLASH_ICON_LIGHT,
    size: 1024,
    safeZoneRadius: 307, // 614px diameter = 307px radius
    description: "Splash screen icon (1024x1024, logo fits within 614px circle)",
  },
  "android-notification-icon": {
    filename: ICON_FILENAMES.ANDROID_NOTIFICATION,
    size: 500,
    description:
      "Android notification icon (500x500, white logo on transparent background)",
  },
};

export type IconType = keyof typeof ICON_SPECS;

export const ALL_ICON_TYPES: IconType[] = Object.keys(
  ICON_SPECS
) as IconType[];

/**
 * Get icons directory for a product
 * @param slug - Product slug
 * @param styleFolder - Optional style folder (e.g., 'christmas', 'halloween')
 */
export function getIconsDir(slug: string, styleFolder?: string): string {
  const baseDir = `public/products/${slug}/icons`;
  return styleFolder ? `${baseDir}/${styleFolder}` : baseDir;
}

/**
 * Get base icon path for a product
 * @param slug - Product slug
 * @param styleFolder - Optional style folder
 */
export function getBaseIconPath(slug: string, styleFolder?: string): string {
  return `${getIconsDir(slug, styleFolder)}/${ICON_FILENAMES.BASE}`;
}

/**
 * Get output icon path for a specific icon type
 * @param slug - Product slug
 * @param iconType - Icon type to generate
 * @param styleFolder - Optional style folder
 */
export function getIconOutputPath(
  slug: string,
  iconType: IconType,
  styleFolder?: string
): string {
  return `${getIconsDir(slug, styleFolder)}/${ICON_SPECS[iconType].filename}`;
}
