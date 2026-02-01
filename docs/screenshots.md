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

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| appName | string | Yes | - | App name, slug, bundleId, or packageName |
| targetLocales | string[] | No | All locales | Specific locales to translate to |
| deviceTypes | ("phone" \| "tablet")[] | No | ["phone", "tablet"] | Device types to process |
| dryRun | boolean | No | false | Preview mode without actual translation |
| skipExisting | boolean | No | true | Skip if raw file already exists |
| screenshotNumbers | number[] \| object | No | All | Specific screenshots to process |
| preserveWords | string[] | No | - | Words to keep untranslated (brand names) |

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

| Device | Width | Height | Ratio |
|--------|-------|--------|-------|
| Phone | 1242 | 2688 | 6.5" iPhone |
| Tablet | 2048 | 2732 | 12.9" iPad Pro |

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| appName | string | Yes | - | App name, slug, bundleId, or packageName |
| sourceLocale | string | No | Primary locale | Locale for dimension reference |
| targetLocales | string[] | No | All with raw/ | Locales to resize |
| deviceTypes | ("phone" \| "tablet")[] | No | ["phone", "tablet"] | Device types to process |
| screenshotNumbers | number[] \| object | No | All | Specific screenshots to process |
| skipExisting | boolean | No | false | Skip if final file exists |
| dryRun | boolean | No | false | Preview mode |

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

---

# Screenshot Tools (한국어)

App Store 로컬라이제이션을 위한 앱 스크린샷 번역 및 리사이징 도구입니다.

## 개요

스크린샷 워크플로우는 두 개의 별도 도구로 구성됩니다:

1. **translate-screenshots**: Gemini API를 사용하여 스크린샷의 텍스트 번역
2. **resize-screenshots**: 번역된 스크린샷을 App Store 규격으로 리사이징

이렇게 분리하면:
- 최종 처리 전에 원본 번역 이미지 검토 가능
- 재번역 없이 리사이징만 다시 실행 (API 비용 절약)
- 로케일별로 다른 리사이징 설정 사용 가능

## 워크플로우

```
1. translate-screenshots → raw/ 폴더에 저장
2. resize-screenshots   → raw/에서 읽어서 최종 위치에 저장
```

### 디렉토리 구조

```
public/products/{app-slug}/screenshots/
├── en-US/                    # 소스 (기본 로케일)
│   └── phone/
│       ├── 1.png
│       └── 2.png
├── ko-KR/
│   └── phone/
│       ├── raw/              # 번역됨 (리사이징 안됨)
│       │   ├── 1.png
│       │   └── 2.png
│       ├── 1.png             # 최종 (리사이징됨)
│       └── 2.png
└── ja-JP/
    └── phone/
        ├── raw/
        └── ...
```

## translate-screenshots

Gemini API를 사용하여 앱 스크린샷의 텍스트를 여러 언어로 번역합니다.

### 요구사항

- `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY` 환경 변수
- 소스 스크린샷: `public/products/{slug}/screenshots/{locale}/phone/` 및 `/tablet/`
- 로케일 파일: `public/products/{slug}/locales/`

### 입력 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| appName | string | 예 | - | 앱 이름, slug, bundleId, 또는 packageName |
| targetLocales | string[] | 아니오 | 전체 로케일 | 번역할 특정 로케일 |
| deviceTypes | ("phone" \| "tablet")[] | 아니오 | ["phone", "tablet"] | 처리할 디바이스 타입 |
| dryRun | boolean | 아니오 | false | 실제 번역 없이 미리보기 |
| skipExisting | boolean | 아니오 | true | raw 파일이 있으면 건너뛰기 |
| screenshotNumbers | number[] \| object | 아니오 | 전체 | 처리할 특정 스크린샷 |
| preserveWords | string[] | 아니오 | - | 번역하지 않을 단어 (브랜드명) |

### 사용 예시

```json
{
  "appName": "my-app",
  "targetLocales": ["ko-KR", "ja-JP"],
  "deviceTypes": ["phone"],
  "preserveWords": ["MyApp", "Pro"]
}
```

### 지원 언어

Gemini API 지원: 영어, 아랍어, 독일어, 스페인어, 프랑스어, 힌디어, 인도네시아어, 이탈리아어, 일본어, 한국어, 포르투갈어, 러시아어, 우크라이나어, 베트남어, 중국어

## resize-screenshots

번역된 스크린샷을 App Store 규격으로 리사이징합니다.

### 목표 크기

| 디바이스 | 너비 | 높이 | 비율 |
|---------|------|------|------|
| Phone | 1242 | 2688 | 6.5" iPhone |
| Tablet | 2048 | 2732 | 12.9" iPad Pro |

### 입력 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| appName | string | 예 | - | 앱 이름, slug, bundleId, 또는 packageName |
| sourceLocale | string | 아니오 | 기본 로케일 | 크기 참조용 로케일 |
| targetLocales | string[] | 아니오 | raw/가 있는 전체 | 리사이징할 로케일 |
| deviceTypes | ("phone" \| "tablet")[] | 아니오 | ["phone", "tablet"] | 처리할 디바이스 타입 |
| screenshotNumbers | number[] \| object | 아니오 | 전체 | 처리할 특정 스크린샷 |
| skipExisting | boolean | 아니오 | false | 최종 파일이 있으면 건너뛰기 |
| dryRun | boolean | 아니오 | false | 미리보기 모드 |

### 배경색

리사이즈 도구는 빈 공간을 배경색으로 채웁니다. `config.json`에서 설정할 수 있습니다:

```json
{
  "metadata": {
    "screenshotBgColor": "#FFFFFF"
  }
}
```

지정하지 않으면 이미지 모서리에서 주요 색상을 자동 감지합니다.

### 사용 예시

```json
{
  "appName": "my-app",
  "targetLocales": ["ko-KR"],
  "deviceTypes": ["phone"]
}
```

## 설정

### config.json

제품의 `config.json`에 스크린샷 설정을 추가합니다:

```json
{
  "slug": "my-app",
  "metadata": {
    "screenshotBgColor": "#000000"
  }
}
```
