# Screenshot Tools

Tools for translating and resizing app screenshots for App Store localization.

## Overview

The screenshot workflow consists of two separate tools:

1. **translate-screenshots**: Translates text in screenshots using Gemini API
2. **resize-screenshots**: Resizes translated screenshots to App Store dimensions

This separation allows for:

- Reviewing raw translated images before final processing
- Re-running resize without re-translating (saves API costs)
- Using different resize settings for different locales

## Workflow

```
1. translate-screenshots → saves to raw/ folder
2. resize-screenshots   → reads from raw/, saves to final location
```

### Directory Structure

```
public/products/{app-slug}/screenshots/
├── en-US/                    # Source (primary locale)
│   └── phone/
│       ├── 1.png
│       └── 2.png
├── ko-KR/
│   └── phone/
│       ├── raw/              # Translated (not resized)
│       │   ├── 1.png
│       │   └── 2.png
│       ├── 1.png             # Final (resized)
│       └── 2.png
└── ja-JP/
    └── phone/
        ├── raw/
        └── ...
```

## translate-screenshots

Translates text in app screenshots to multiple languages using Gemini API.

### Requirements

- `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable
- Source screenshots in: `public/products/{slug}/screenshots/{locale}/phone/` and `/tablet/`
- Locale files in: `public/products/{slug}/locales/`

### Input Parameters

| Parameter         | Type                    | Required | Default             | Description                              |
| ----------------- | ----------------------- | -------- | ------------------- | ---------------------------------------- |
| appName           | string                  | Yes      | -                   | App name, slug, bundleId, or packageName |
| targetLocales     | string[]                | No       | All locales         | Specific locales to translate to         |
| deviceTypes       | ("phone" \| "tablet")[] | No       | ["phone", "tablet"] | Device types to process                  |
| dryRun            | boolean                 | No       | false               | Preview mode without actual translation  |
| skipExisting      | boolean                 | No       | true                | Skip if raw file already exists          |
| screenshotNumbers | number[]                | No       | All                 | Specific screenshots to process          |
| preserveWords     | string[]                | No       | -                   | Words to keep untranslated (brand names) |

### Example Usage

```json
{
  "appName": "my-app",
  "targetLocales": ["ko-KR", "ja-JP"],
  "deviceTypes": ["phone"],
  "preserveWords": ["MyApp", "Pro"]
}
```

### Supported Languages

Gemini API supports: English, Arabic, German, Spanish, French, Hindi, Indonesian, Italian, Japanese, Korean, Portuguese, Russian, Ukrainian, Vietnamese, Chinese.

## resize-screenshots

Resizes translated screenshots to App Store dimensions.

### Target Dimensions

| Device | Width | Height | Ratio          |
| ------ | ----- | ------ | -------------- |
| Phone  | 1242  | 2688   | 6.5" iPhone    |
| Tablet | 2048  | 2732   | 12.9" iPad Pro |

### Input Parameters

| Parameter         | Type                    | Required | Default             | Description                              |
| ----------------- | ----------------------- | -------- | ------------------- | ---------------------------------------- |
| appName           | string                  | Yes      | -                   | App name, slug, bundleId, or packageName |
| sourceLocale      | string                  | No       | Primary locale      | Locale for dimension reference           |
| targetLocales     | string[]                | No       | All with raw/       | Locales to resize                        |
| deviceTypes       | ("phone" \| "tablet")[] | No       | ["phone", "tablet"] | Device types to process                  |
| screenshotNumbers | number[]                | No       | All                 | Specific screenshots to process          |
| skipExisting      | boolean                 | No       | false               | Skip if final file exists                |
| dryRun            | boolean                 | No       | false               | Preview mode                             |

### Background Color

The resize tool fills empty space with a background color. You can configure this in `config.json`:

```json
{
  "metadata": {
    "screenshotBgColor": "#FFFFFF"
  }
}
```

If not specified, the tool auto-detects the dominant color from image corners.

### Example Usage

```json
{
  "appName": "my-app",
  "targetLocales": ["ko-KR"],
  "deviceTypes": ["phone"]
}
```

## Configuration

### config.json

Add screenshot settings to your product's `config.json`:

```json
{
  "slug": "my-app",
  "metadata": {
    "screenshotBgColor": "#000000"
  }
}
```
