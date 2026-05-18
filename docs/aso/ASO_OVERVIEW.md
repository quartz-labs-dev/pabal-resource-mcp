# ASO Overview

ASO (App Store Optimization) is the practice of shaping an app's name, subtitle, keywords, and description so the app is easier to discover in store search and more compelling in search results.

## Title and Subtitle

### App Name

The app name should combine the app brand with the most relevant core keyword.

- Recommended format: `App Name: Primary Keyword`
- Example: `Headspace: Mindful Meditation`
- Keep the app name stable and place the most important search keyword after the colon.
- Stay within the title length limit in `docs/aso/ASO_FIELD_LIMITS.md`.

### Subtitle

The subtitle should describe the app's main value using keywords that are not already used in the title.

- Example: `Relaxations for Sleep & Stress`
- Do not repeat keywords that already appear in the title.
- Stay within the subtitle length limit.

## Keywords

`aso.keywords` is the search-term list used for the App Store keywords field.

- Separate even single-word keywords with commas.
- Use commas only, with no spaces.
- Do not include keywords that duplicate the title or subtitle.
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

1. Is this keyword's popularity score at least 20?
2. Is this keyword's difficulty within a range your app can compete for?
3. Are there apps in the top 10 for this keyword that your app can realistically compete with?
4. Is this keyword truly relevant to your app?
5. Would your target users use this keyword to find your app?

## Application Order

1. Put the most relevant core keyword in the app name.
2. Put important keywords not used in the title into the subtitle.
3. Put the remaining keywords in `aso.keywords`, ordered by importance, and expand the list until it is as close to 100 characters as possible without lowering relevance.
4. Remove duplicates, spaces, unnecessary plural forms, and title/subtitle repetition from the keyword list.
5. Validate length limits against `docs/aso/ASO_FIELD_LIMITS.md`.
