# ASO Tools

Tools for App Store Optimization data management.

## Tools

### aso-to-public (pull)

Converts ASO data from `.aso/pullData/` to `public/products/[slug]/` format.

**Input:**
- `slug` (required): Product slug
- `locale` (optional): Target locale (defaults to all available)

**Output:**
- Conversion prompts for each locale
- Structured data ready for web use

---

### public-to-aso (push)

Converts `public/products/[slug]/` data back to ASO format for `.aso/pushData/`.

**Input:**
- `slug` (required): Product slug
- `dryRun` (optional): Preview without writing files
- `locales` (optional): Specific locales to process

**Output:**
- Store-ready ASO data
- Screenshot paths for upload

---

### improve-public

Generates ASO optimization prompts for existing public data.

**Input:**
- `slug` (required): Product slug
- `locale` (optional): Target locale for optimization
- `mode` (optional): `primary` (keyword optimization) or `localize` (translation)

**Output:**
- Keyword analysis
- Optimization suggestions
- Localization prompts

---

### validate-aso

Validates ASO data against store field limits and rules.

**Input:**
- `slug` (required): Product slug
- `store` (optional): `appStore`, `googlePlay`, or `both`

**Output:**
- Field length validation
- Keyword uniqueness check
- Policy compliance warnings

---

### keyword-research

Manages keyword research data for ASO optimization.

**Input:**
- `slug` (required): Product slug
- `locale` (required): Target locale
- `platform` (optional): `ios` or `android`

**Output:**
- Keyword research file paths
- Research prompts for analysis

---

### localize-screenshots

Translates app screenshots to multiple languages using Gemini API (gemini-3-pro-image-preview).

**Requirements:**
- Gemini API key must be configured (see [Configuration](#gemini-api-configuration))
- Screenshots must exist in `public/products/{slug}/screenshots/{locale}/phone/` and/or `tablet/`

**Input:**
- `appName` (required): App name, slug, bundleId, or packageName
- `targetLocales` (optional): Specific locales to translate to (defaults to all supported locales)
- `deviceTypes` (optional): `["phone"]`, `["tablet"]`, or `["phone", "tablet"]` (default: both)
- `dryRun` (optional): Preview mode without actual translation (default: false)
- `skipExisting` (optional): Skip if translated file exists (default: true)
- `screenshotNumbers` (optional): Specific screenshot numbers to process
  - Array for all devices: `[1, 3, 5]`
  - Object for per-device: `{ phone: [1, 2], tablet: [1, 3, 5] }`
  - If not provided, all screenshots will be processed
- `preserveWords` (optional): Words to keep untranslated (e.g., `["Pabal", "Pro", "AI"]`)

**Output:**
- Translated screenshots saved to `screenshots/{targetLocale}/phone/` and `tablet/`
- Images automatically resized to match source dimensions

**Cost Information:**
- Image generation costs approximately $0.13 per image

**Supported Languages:**

For best performance, only the following languages are supported for image generation, as specified in the [Gemini API documentation](https://ai.google.dev/gemini-api/docs/image-generation#limitations):

| Gemini Locale | Output Locales (UnifiedLocale) |
|---------------|-------------------------------|
| `en-US` (English) | en-US, en-AU, en-CA, en-GB, en-IN, en-SG, en-ZA |
| `ar-EG` (Arabic) | ar |
| `de-DE` (German) | de-DE |
| `es-MX` (Spanish) | es-419, es-ES, es-US |
| `fr-FR` (French) | fr-FR, fr-CA |
| `hi-IN` (Hindi) | hi-IN |
| `id-ID` (Indonesian) | id-ID |
| `it-IT` (Italian) | it-IT |
| `ja-JP` (Japanese) | ja-JP |
| `ko-KR` (Korean) | ko-KR |
| `pt-BR` (Portuguese) | pt-BR, pt-PT |
| `ru-RU` (Russian) | ru-RU |
| `ua-UA` (Ukrainian) | uk-UA |
| `vi-VN` (Vietnamese) | vi-VN |
| `zh-CN` (Chinese) | zh-Hans, zh-Hant, zh-HK |

Similar locales are grouped together to reduce API calls. For example, translating to Spanish (`es-MX`) will automatically save the same image to `es-419`, `es-ES`, and `es-US` folders.

Locales not in the supported list will be skipped during translation.

**Example:**
```
screenshots/
├── en-US/           # Source (primary locale)
│   ├── phone/
│   │   ├── 1.png
│   │   └── 2.png
│   └── tablet/
│       └── 1.png
├── ko-KR/           # Generated
│   ├── phone/
│   │   ├── 1.png
│   │   └── 2.png
│   └── tablet/
│       └── 1.png
└── ja-JP/           # Generated
    └── ...
```

---

## Gemini API Configuration

The `localize-screenshots` tool requires a Gemini API key.

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key
5. **Important**: Link a billing account at [Google Cloud Console](https://console.cloud.google.com/billing) to enable the Imagen API

### Configuration

Add to `~/.config/pabal-mcp/config.json`:

```json
{
  "dataDir": "/path/to/your/project",
  "gemini": {
    "apiKey": "your-gemini-api-key"
  }
}
```

Alternatively, set the `GEMINI_API_KEY` environment variable.

---

## Field Limits Reference

### Apple App Store
| Field | Limit |
|-------|-------|
| App name | ≤30 chars |
| Subtitle | ≤30 chars |
| Keywords | ≤100 chars |
| Promotional text | ≤170 chars |
| Description | ≤4000 chars |
| What's New | ≤4000 chars |

### Google Play
| Field | Limit |
|-------|-------|
| Title | ≤50 chars (≤30 recommended) |
| Short description | ≤80 chars |
| Full description | ≤4000 chars |
| Release notes | ≤500 chars |
