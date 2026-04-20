/**
 * Screenshot generator configuration types
 * Structure for public/products/{slug}/screenshot-generator.config.json
 */

export interface ScreenshotGeneratorThemeTokens {
  backgroundStart: string;
  backgroundEnd: string;
  panel: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
}

export interface ScreenshotGeneratorSlideConfig {
  fileName: string;
  badge?: string;
  headline?: string;
}

export interface ScreenshotGeneratorConfig {
  title?: string;
  subtitle?: string;
  statusLabel?: string;
  layoutVariant?: "showcase-dark" | "clean-light";
  accentGradient?: string;
  theme?: Partial<ScreenshotGeneratorThemeTokens>;
  slides?: ScreenshotGeneratorSlideConfig[];
}
