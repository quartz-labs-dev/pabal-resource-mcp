# ASO Field Limits (App Store / Google Play)

Hard limits and gotchas for all text fields we upload to each store. Character counts are inclusive of spaces. Excessive emojis, special characters, or screaming caps are risky on both stores.

## Mapping overview (public → store)
- `aso.title` → App Store `name`, Google Play `title`
- `aso.subtitle` → App Store `subtitle`
- `aso.shortDescription` → Google Play `shortDescription`
- `aso.keywords` → App Store `keywords` (comma-separated)
- `aso.template.intro/outro` + body → App Store `description`, Google Play `fullDescription`
- `aso.promotionalText` → App Store `promotionalText`
- Release notes → App Store `whatsNew`, Google Play `releaseNotes` (per track)

## Apple App Store (App Store Connect)
- App name (`name`): ≤30 chars
- Subtitle (`subtitle`): ≤30 chars
- Keywords (`keywords`): ≤100 chars, comma-separated, no duplicates
- Promotional text (`promotionalText`): ≤170 chars, editable any time
- Description (`description`): ≤4000 chars
- What's New (`whatsNew`): ≤4000 chars
- URLs (`supportUrl`, `marketingUrl`, `privacyPolicyUrl`): valid HTTPS recommended; no strict length limit but overly long or redirect-heavy links can be rejected
- Avoid: price/ranking claims, competitor comparisons, keyword stuffing, excessive symbols/emojis, misuse of third-party trademarks

## Google Play Console
- App name (`title`): hard cap 50 chars; policy recommends ≤30 (shorter is better for quality)
- Short description (`shortDescription`): ≤80 chars
- Full description (`fullDescription`): ≤4000 chars
- Release notes (`releaseNotes` per track): ≤500 chars
- Avoid: emoji/symbol spam, keyword stuffing, repetition/all caps, price/ranking/download claims, trademark misuse, missing contact info (email/phone)

## Validation checklist
1. Lengths: App Store (title/subtitle ≤30, keywords ≤100, promotionalText ≤170, description/whatsNew ≤4000) / Google Play (title ≤50, shortDescription ≤80, fullDescription ≤4000, releaseNotes ≤500)
2. Keywords: App Store only, unique values, comma-separated, ≤100 chars
3. Store rules: banned phrases, emoji/symbol abuse, excessive repetition
4. Localization: translated to target language; keep the app name un-translated
5. Invalid characters: remove control/zero-width/BOM/hidden chars (incl. variation selectors like U+FE0E/U+FE0F) and emojis that can trigger `ENTITY_ERROR.ATTRIBUTE.INVALID.INVALID_CHARACTERS`
