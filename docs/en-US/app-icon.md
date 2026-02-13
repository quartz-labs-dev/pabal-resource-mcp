# App Icon Tools

Tools for generating platform-specific app icons from a single base icon.

## Overview

The **generate-app-icons** tool creates all required app icon variations from a single base icon (`icon.png`):

1. **iOS app icon** (1024x1024) - Logo fits within 890px circle
2. **Android adaptive icon** (1024x1024) - Logo fits within 475px circle
3. **Splash screen icon** (1024x1024) - Logo fits within 614px circle
4. **Android notification icon** (500x500) - White logo on transparent background

## Workflow

```
1. Place your base icon at: {app-slug}/icons/icon.png
2. Run generate-app-icons → generates all platform-specific icons
```

### Directory Structure

```
public/products/{app-slug}/icons/
├── icon.png                          # Base source icon
├── ios-light.png                     # iOS app icon (1024x1024)
├── adaptive-icon.png                 # Android adaptive icon (1024x1024)
├── splash-icon-light.png             # Splash screen icon (1024x1024)
└── android-notification-icon.png     # Notification icon (500x500, white)
```

## generate-app-icons

Generates platform-specific app icons from a base icon.

### Requirements

- Base icon at: `public/products/{slug}/icons/icon.png`
- **For notification icon**: `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable

### Input Parameters

| Parameter       | Type                                                                                | Required | Default       | Description                                |
| --------------- | ----------------------------------------------------------------------------------- | -------- | ------------- | ------------------------------------------ |
| appName         | string                                                                              | Yes      | -             | App name, slug, bundleId, or packageName   |
| iconTypes       | ("ios-light" \| "adaptive-icon" \| "splash-icon-light" \| "android-notification")[] | No       | All types     | Specific icon types to generate            |
| backgroundColor | string                                                                              | No       | "transparent" | Background color (hex or "transparent")    |
| logoPosition    | string                                                                              | No       | -             | Positioning hint for Gemini API            |
| skipExisting    | boolean                                                                             | No       | false         | Skip if output file exists                 |
| dryRun          | boolean                                                                             | No       | false         | Preview mode without actual generation     |

### Icon Specifications

#### 1. iOS Light Icon (`ios-light.png`)

- **Size**: 1024x1024px
- **Safe Zone**: Logo fits within 890px diameter circle (445px radius)
- **Background**: Configurable (transparent or custom color)
- **Use Case**: iOS App Store icon

#### 2. Android Adaptive Icon (`adaptive-icon.png`)

- **Size**: 1024x1024px
- **Safe Zone**: Logo fits within 475px diameter circle (237.5px radius)
- **Background**: Configurable (transparent or custom color)
- **Use Case**: Android launcher icon (adaptive)

#### 3. Splash Icon Light (`splash-icon-light.png`)

- **Size**: 1024x1024px
- **Safe Zone**: Logo fits within 614px diameter circle (307px radius)
- **Background**: Configurable (transparent or custom color)
- **Use Case**: App splash screen icon

#### 4. Android Notification Icon (`android-notification-icon.png`)

- **Size**: 500x500px
- **Style**: White logo on transparent background
- **Background**: Always transparent
- **Use Case**: Android status bar notification icon
- **Note**: Uses Gemini API for intelligent white masking

### Example Usage

#### Generate All Icons with Transparent Background

```json
{
  "appName": "my-app"
}
```

#### Generate Specific Icons with White Background

```json
{
  "appName": "my-app",
  "iconTypes": ["ios-light", "adaptive-icon"],
  "backgroundColor": "#FFFFFF"
}
```

#### Custom Logo Positioning for Notification Icon

```json
{
  "appName": "my-app",
  "iconTypes": ["android-notification-icon"],
  "logoPosition": "centered with slight emphasis on upper portion"
}
```

## Safe Zone Guidelines

The safe zone ensures your logo remains visible across different platform icon treatments:

| Icon Type      | Safe Zone Diameter | Why?                                  |
| -------------- | ------------------ | ------------------------------------- |
| iOS Light      | 890px (87%)        | iOS rounds corners and applies masks  |
| Adaptive Icon  | 475px (46%)        | Android clips to various shapes       |
| Splash Icon    | 614px (60%)        | Balanced visibility for splash screen |

**Recommendation**: Design your base `icon.png` so the important logo elements fit within the smallest safe zone (475px for adaptive icon).

## Background Colors

### Using Transparent Background (Default)

```json
{
  "appName": "my-app",
  "backgroundColor": "transparent"
}
```

### Using Custom Color

```json
{
  "appName": "my-app",
  "backgroundColor": "#000000"
}
```

**Note**: The `android-notification-icon` always has a transparent background regardless of this setting.

## AI-Powered White Masking

The notification icon generation uses Gemini API to intelligently convert your logo to white while preserving its shape and details:

- Maintains exact logo shape and contours
- Converts all logo pixels to pure white (#FFFFFF)
- Makes background completely transparent
- Respects logo positioning hints

### Logo Positioning Hints

Provide natural language hints to guide the AI:

- `"centered"` - Logo perfectly centered
- `"slightly above center"` - Logo positioned higher
- `"with emphasis on brand text"` - Focus on text elements

## Tips & Best Practices

### Base Icon Design

1. **Simplicity**: Simple, recognizable designs work best at small sizes
2. **Contrast**: Ensure good contrast between logo and background
3. **Safe Zone**: Keep important elements within 475px circle
4. **High Resolution**: Use vector graphics or high-res PNG (2048x2048+)

### Color Choices

- **Transparent**: Best for logos with distinct shapes
- **Brand Color**: Matches your app's brand identity
- **White/Black**: Classic, works well with most designs

### File Organization

```
icons/
├── icon.png              # Source (high quality)
├── ios-light.png         # Generated
├── adaptive-icon.png     # Generated
├── splash-icon-light.png # Generated
└── android-notification-icon.png # Generated
```

Keep `icon.png` in version control, but consider `.gitignore` for generated files if you regenerate them frequently.

## Common Issues

### Issue: Logo appears too small in adaptive icon

**Solution**: The adaptive icon has the smallest safe zone (475px). Ensure your logo is legible at this size.

### Issue: Notification icon has unwanted elements

**Solution**: Use `logoPosition` parameter to guide the AI, or edit `icon.png` to simplify the design before generation.

### Issue: Background color not applied

**Solution**: Check that `backgroundColor` is a valid hex color (e.g., `"#FFFFFF"`) or `"transparent"`. Note that notification icons always use transparent background.
