# pabal-web-mcp

ASO (App Store Optimization)와 웹 SEO 데이터 간의 양방향 변환을 위한 MCP (Model Context Protocol) 서버입니다.

이 라이브러리는 ASO 데이터를 웹 SEO 목적으로 원활하게 재사용할 수 있도록 하며, ASO 메타데이터를 웹 SEO 콘텐츠로 직접 변환하거나 그 반대로 변환할 수 있습니다.

[![English docs](https://img.shields.io/badge/docs-English-blue)](../README.md)

## 🛠️ MCP 클라이언트 설치

### 요구사항

- Node.js >= 18
- MCP 클라이언트: Cursor, Claude Code, VS Code, Windsurf 등

> [!TIP]
> ASO/스토어 작업을 반복적으로 수행하는 경우, "always use pabal-web-mcp"와 같은 클라이언트 규칙을 추가하여 매번 입력하지 않고도 MCP 서버가 자동으로 호출되도록 할 수 있습니다.

<details>
<summary><b>Cursor에 설치</b></summary>

`~/.cursor/mcp.json` (전역) 또는 프로젝트 `.cursor/mcp.json`에 추가:

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "npx",
      "args": ["-y", "pabal-web-mcp"]
    }
  }
}
```

또는 전역으로 설치한 경우:

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "pabal-web-mcp"
    }
  }
}
```

</details>

<details>
<summary><b>VS Code에 설치</b></summary>

`settings.json` MCP 섹션 예시:

```json
"mcp": {
  "servers": {
    "pabal-web-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "pabal-web-mcp"]
    }
  }
}
```

또는 전역으로 설치한 경우:

```json
"mcp": {
  "servers": {
    "pabal-web-mcp": {
      "type": "stdio",
      "command": "pabal-web-mcp"
    }
  }
}
```

</details>

<details>
<summary><b>Claude Code에 설치</b></summary>

> [!TIP]
> 자세한 설정 옵션은 [공식 Claude Code MCP 문서](https://code.claude.com/docs/en/mcp#setting-up-enterprise-mcp-configuration)를 참조하세요.

Claude Code MCP 설정에 추가 (JSON 형식):

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "npx",
      "args": ["-y", "pabal-web-mcp"]
    }
  }
}
```

또는 전역으로 설치한 경우 (`npm install -g pabal-web-mcp`):

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "pabal-web-mcp"
    }
  }
}
```

</details>

<details>
<summary><b>Windsurf에 설치</b></summary>

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "npx",
      "args": ["-y", "pabal-web-mcp"]
    }
  }
}
```

또는 전역으로 설치한 경우:

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "pabal-web-mcp"
    }
  }
}
```

</details>

## MCP 서버

이 패키지는 Claude 또는 기타 MCP 호환 클라이언트를 통해 ASO 데이터를 관리하기 위한 MCP 서버를 포함합니다.

### 사용 가능한 도구

| 도구             | 설명                                        |
| ---------------- | ------------------------------------------- |
| `aso-to-public`  | ASO 데이터를 public config 형식으로 변환    |
| `public-to-aso`  | public config를 ASO 데이터 형식으로 변환    |
| `improve-public` | AI 제안으로 제품 로케일 콘텐츠 개선         |
| `init-project`   | 새로운 제품 프로젝트 구조 초기화             |

## 사용법

### 타입 가져오기

```typescript
import type {
  // ASO Types
  AsoData,
  AppStoreAsoData,
  GooglePlayAsoData,

  // Product Types
  ProductConfig,
  ProductLocale,
  LandingPage,
  LandingHero,
  LandingScreenshots,
  LandingFeatures,
  LandingReviews,
  LandingCta,
} from "pabal-web-mcp";
```

### 유틸리티 가져오기

```typescript
import {
  // ASO Converter
  loadAsoFromConfig,

  // Locale Constants
  DEFAULT_LOCALE,
  UNIFIED_LOCALES,

  // Locale Converters
  unifiedToAppStore,
  unifiedToGooglePlay,
  appStoreToUnified,
  googlePlayToUnified,
} from "pabal-web-mcp";
```

### 예제: ASO 데이터 로드

```typescript
import { loadAsoFromConfig } from "pabal-web-mcp";

const asoData = loadAsoFromConfig("my-app");
console.log(asoData.appStore?.name);
console.log(asoData.googlePlay?.title);
```

## 타입 참조

### ASO 타입

- `AsoData` - 두 스토어 모두를 위한 통합 ASO 데이터
- `AppStoreAsoData` - App Store 전용 ASO 데이터
- `GooglePlayAsoData` - Google Play 전용 ASO 데이터
- `AppStoreMultilingualAsoData` - 다국어 App Store 데이터
- `GooglePlayMultilingualAsoData` - 다국어 Google Play 데이터

### 제품 타입

- `ProductConfig` - 제품 설정
- `ProductLocale` - 현지화된 제품 콘텐츠
- `LandingPage` - 랜딩 페이지 구조
- `AppPageData` - 완전한 앱 페이지 데이터

### 로케일 타입

- `UnifiedLocale` - 통합 로케일 코드 (예: "en-US", "ko-KR")

## 지원 로케일

각 스토어에서 지원하는 모든 언어 지원

| Unified | App Store | Google Play |
| ------- | --------- | ----------- |
| en-US   | en-US     | en-US       |
| ko-KR   | ko        | ko-KR       |
| ja-JP   | ja        | ja-JP       |
| zh-CN   | zh-Hans   | zh-CN       |
| zh-TW   | zh-Hant   | zh-TW       |
| de-DE   | de-DE     | de-DE       |
| fr-FR   | fr-FR     | fr-FR       |
| es-ES   | es-ES     | es-ES       |
| pt-BR   | pt-BR     | pt-BR       |
| ...     | ...       | ...         |

## 라이선스

MIT

---

<br>

## 🌐 Pabal Web

ASO와 SEO를 함께 관리하고 싶으신가요? **Pabal Web**을 확인해보세요.

[![Pabal Web](../public/pabal-web.png)](https://pabal.quartz.best/)

**Pabal Web**은 ASO, SEO, Google Search Console 인덱싱 등을 통합 관리하기 위한 완전한 솔루션을 제공하는 Next.js 기반 웹 인터페이스입니다.

👉 [Pabal Web 방문하기](https://pabal.quartz.best/)

