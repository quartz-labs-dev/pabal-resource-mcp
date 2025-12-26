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
