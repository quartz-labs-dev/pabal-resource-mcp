# Content Tools

Tools for content generation.

## Tools

### create-blog-html

Generate static HTML blog posts with `BLOG_META` blocks.

**Input:**
- `appSlug` (optional): Blog category/app slug. Defaults to `developer-journal`.
  - Use `developer-journal` for personal/journal posts.
  - Use `developer-tech` for technical posts.
- `topic` (required): Main topic/angle.
- `locale` (required): Target locale (e.g., `en-US`, `ko-KR`).
- `content` (required): HTML body content.
- `description` (required): Meta description.
- `title` (optional): English title used for slug generation.
- `locales` (optional): Generate multiple locales at once.
- `coverImage` (optional): Relative paths are rewritten under `/blogs/<app>/<slug>/...`.
- `publishedAt`, `modifiedAt` (optional): `YYYY-MM-DD`.
- `overwrite` (optional): Overwrite existing files.

**Output:**
- Generated HTML file paths
- Resolved slug
- BLOG_META per locale

**Notes:**
- Output path: `public/blogs/<appSlug>/<slug>/<locale>.html`
- Default cover image:
  - `developer-journal`, `developer-tech` -> `/og-image.png`
  - other app slugs -> `/products/<appSlug>/og-image.png`
