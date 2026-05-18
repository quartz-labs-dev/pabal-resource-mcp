# ASO Overview

ASO (App Store Optimization) is the practice of shaping an app's name, subtitle, keywords, and description so the app is easier to discover in store search and more compelling in search results.

## Title and Subtitle

ASO metadata should place important search terms in strict priority order:

1. Title
2. Subtitle
3. Keywords

Do not repeat the same keyword term across these three fields. If a term is used in the title, do not use it again in the subtitle or `aso.keywords`. If a term is used in the subtitle, do not use it again in `aso.keywords`.

Apply tracked keywords to App Store Connect metadata by relevance and current rank:

- Tag the best keyword that fits within the 30-character title limit as `title`.
- Tag the next best keyword that fits within the 30-character subtitle limit as `subtitle`.
- Tag the remaining high-value keywords that fit within the 100-character keyword field as `keyword field`.
- Put the highest-importance keywords on the left side of every field.
- Do not split multi-word keywords across fields. Keep a phrase in one field instead of placing one word in the title and another word in the subtitle.
- Use singular forms only. Apple automatically indexes plural forms.
- Exclude stop words that Apple ignores, such as `a`, `and`, `the`, `for`, `with`, `app`, and `to`.
- Exclude company/app names and inherited category names, such as `InnerGrow` or `Health & Fitness`.
- Remember that `&`, `:`, and `-` count as 2 characters in the title field.
- Format `aso.keywords` with commas only and no spaces.

### App Name

The app name should combine the app brand with the most relevant core keyword.

- Recommended format: `App Name: Primary Keyword`
- Example: `Headspace: Mindful Meditation`
- Keep the app name stable and place the most important search keyword after the colon.
- Use the single most important keyword opportunity here before using any other metadata field.
- Stay within the title length limit in `docs/aso/ASO_FIELD_LIMITS.md`.

### Subtitle

The subtitle should describe the app's main value using keywords that are not already used in the title.

- Example: `Relaxations for Sleep & Stress`
- Do not repeat keywords that already appear in the title.
- Use the next most important keyword opportunities after the title.
- Stay within the subtitle length limit.

## Keywords

`aso.keywords` is the search-term list used for the App Store keywords field.

- Separate even single-word keywords with commas.
- Use commas only, with no spaces.
- Do not include keywords that duplicate the title or subtitle.
- Use only remaining keyword opportunities that were not already used in the title or subtitle.
- Prefer singular forms. Example: use `habit` instead of `habits`.
- Misspellings can be valid keywords if users actually search for them.
- Put the most important keywords first.
- Use as much of the 100-character limit as possible with relevant, defensible keywords. Do not leave meaningful capacity unused, but do not add weak or irrelevant filler just to reach 100 characters.

For example, if you want to target `relaxing sound` and `rain sound`, write:

```text
sound,relaxing,rain
```

If you want to include `book` and `tracker` as separate single-word keywords, also separate them with commas only.

```text
book,tracker
```

## Keyword Selection Checklist

Before choosing a keyword, check the following:

1. For US Store keyword suggestions, is this keyword's popularity score higher than 25?
2. For US Store keyword suggestions, is this keyword's difficulty lower than 75?
3. Are there apps in the top 10 for this keyword that your app can realistically compete with?
4. Is this keyword truly relevant to your app?
5. Would your target users use this keyword to find your app?

Only add US Store keyword suggestions that pass both thresholds: popularity >25 and difficulty <75.

## Application Order

1. Put the most relevant core keyword in the app name.
2. Put important keywords not used in the title into the subtitle.
3. Put the remaining keywords in `aso.keywords`, ordered by importance, and expand the list until it is as close to 100 characters as possible without lowering relevance.
4. Remove duplicates, spaces, unnecessary plural forms, and any overlap between title, subtitle, and keywords.
5. Validate length limits against `docs/aso/ASO_FIELD_LIMITS.md`.

## Keyword Source Priority

When improving public product metadata, apply keyword sources in this order:

1. Product-level manual CSV files at `.aso/keywordResearch/products/[slug]/*.csv`.
2. Locale-specific saved keyword research at `.aso/keywordResearch/products/[slug]/locales/[locale]/`.
3. Translated fallback keyword research, only when locale-specific research is missing.

Manual CSV keywords are human-curated priority input. First use rows where the CSV `Store Domain` matches the target locale's country. If the CSV has no rows for that country, use the `us` rows as source keywords and translate/localize them for the target locale.

Even when manual CSV keywords exist, review the locale-specific saved keyword research alongside them. Use saved research to validate relevance, avoid weak translations, and fill remaining title, subtitle, and keyword-field capacity without creating duplicates.
