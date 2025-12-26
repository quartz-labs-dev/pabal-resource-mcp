# pabal-web-mcp 문서

ASO(App Store Optimization)와 웹 SEO 데이터 간 양방향 변환을 위한 MCP (Model Context Protocol) 서버.

이 라이브러리는 ASO 데이터를 웹 SEO 용도로 원활하게 재사용할 수 있도록 하며, ASO 메타데이터를 웹 SEO 콘텐츠로 직접 변환하거나 그 반대로 변환할 수 있습니다. App Store Connect 및 Google Play Console의 ASO 데이터를 기반으로 **동기화된 웹사이트를 구축**하여 앱 스토어 목록과 웹 프레젠스를 완벽하게 동기화합니다.

> 💡 **예제**: 이 라이브러리로 구축된 실제 웹사이트를 확인해보세요. [labs.quartz.best](https://labs.quartz.best/)에서는 앱 스토어 데이터가 자동으로 동기화되어 아름답고 SEO 최적화된 웹 프레젠스를 만듭니다.

## 🛠️ 설치

### 요구사항

- Node.js >= 18
- [pabal-mcp](https://github.com/quartz-labs-dev/pabal-mcp) 설치 및 설정 필요

### 라이브러리로 설치

웹사이트 프로젝트에 이 라이브러리를 설치하세요:

```bash
npm install pabal-web-mcp
# 또는
yarn add pabal-web-mcp
# 또는
pnpm add pabal-web-mcp
```

### MCP 클라이언트 설정

> **참고**: `mcp-appstore` 서버는 키워드 연구 기능에 필요합니다. 먼저 의존성을 설치하세요: `cd external-tools/mcp-appstore && npm install`

#### Cursor에 설치

`~/.cursor/mcp.json` (전역) 또는 프로젝트 `.cursor/mcp.json`에 추가:

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "npx",
      "args": ["-y", "pabal-web-mcp"]
    },
    "mcp-appstore": {
      "command": "node",
      "args": [
        "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"
      ],
      "cwd": "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

전역 설치인 경우:

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "pabal-web-mcp"
    },
    "mcp-appstore": {
      "command": "node",
      "args": [
        "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"
      ],
      "cwd": "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

#### VS Code에 설치

`settings.json` MCP 섹션 예시:

```json
"mcp": {
  "servers": {
    "pabal-web-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "pabal-web-mcp"]
    },
    "mcp-appstore": {
      "type": "stdio",
      "command": "node",
      "args": ["/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"],
      "cwd": "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

전역 설치인 경우:

```json
"mcp": {
  "servers": {
    "pabal-web-mcp": {
      "type": "stdio",
      "command": "pabal-web-mcp"
    },
    "mcp-appstore": {
      "type": "stdio",
      "command": "node",
      "args": ["/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"],
      "cwd": "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

#### Claude Code에 설치

> [!TIP]
> 자세한 설정 옵션은 [공식 Claude Code MCP 문서](https://code.claude.com/docs/en/mcp#setting-up-enterprise-mcp-configuration)를 참조하세요.

Claude Code MCP 설정에 추가 (JSON 형식):

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "npx",
      "args": ["-y", "pabal-web-mcp"]
    },
    "mcp-appstore": {
      "command": "node",
      "args": [
        "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"
      ],
      "cwd": "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

전역 설치인 경우:

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "pabal-web-mcp"
    },
    "mcp-appstore": {
      "command": "node",
      "args": [
        "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"
      ],
      "cwd": "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

#### Windsurf에 설치

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "npx",
      "args": ["-y", "pabal-web-mcp"]
    },
    "mcp-appstore": {
      "command": "node",
      "args": [
        "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"
      ],
      "cwd": "/절대경로/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

## 🔐 인증 정보 설정

pabal-web-mcp는 `pabal-mcp`의 설정 파일을 사용합니다. 자세한 인증 설정 방법(App Store Connect API 키, Google Play 서비스 계정 등)은 [pabal-mcp README](https://github.com/quartz-labs-dev/pabal-mcp?tab=readme-ov-file#-configure-credentials)를 참조하세요.

### ⚠️ 중요: dataDir 경로 설정

**`~/.config/pabal-mcp/config.json`에서 `dataDir`을 로컬 머신에 저장된 `pabal-web` 프로젝트의 절대 경로로 설정해야 합니다.**

```json
{
  "dataDir": "/절대경로/TO/pabal-web",
  "appStore": {
    "issuerId": "xxxx",
    "keyId": "xxxx",
    "privateKeyPath": "./app-store-key.p8"
  },
  "googlePlay": {
    "serviceAccountKeyPath": "./google-play-service-account.json"
  }
}
```

예시:

- macOS: `"/Users/username/projects/pabal-web"`
- Linux: `"/home/username/projects/pabal-web"`
- Windows: `"C:\\Users\\username\\projects\\pabal-web"`

## MCP 서버

이 패키지는 Claude 또는 기타 MCP 호환 클라이언트를 통해 ASO 데이터를 관리하는 MCP 서버를 포함합니다.

### 사용 가능한 툴

| 툴                 | 설명                                               |
| ------------------ | -------------------------------------------------- |
| `aso-to-public`    | ASO 데이터를 public config 형식으로 변환           |
| `public-to-aso`    | public config를 ASO 데이터 형식으로 변환           |
| `keyword-research` | ASO 키워드 연구 계획/저장 (.aso/keywordResearch)   |
| `improve-public`   | AI 제안으로 제품 로케일 콘텐츠 개선                |
| `init-project`     | 새로운 제품 프로젝트 구조 초기화                   |
| `create-blog-html` | BLOG_META 헤더가 있는 정적 HTML 블로그 게시물 생성 |

### 외부 키워드 MCP 사용 ([appreply-co/mcp-appstore](https://github.com/appreply-co/mcp-appstore))

`mcp-appstore` 서버는 `keyword-research` 툴과 함께 작동하는 키워드 연구 기능을 제공합니다. 사용하려면:

1. 기존 클론에서 의존성 설치: `cd external-tools/mcp-appstore && npm install`
2. MCP 클라이언트에 `mcp-appstore` 등록 (위 설정 예시 참조)
3. `improve-public` 전에 키워드 데이터를 제공하기 위해 `keyword-research`와 함께 사용 (`.aso/keywordResearch/...`에 저장).

> **참고**: MCP 클라이언트가 허용하는 경우, LLM이 키워드 연구 전에 이 프로세스를 시작하고 이후에 중지하도록 하세요. 그렇지 않으면 수동으로 시작/중지하세요.

### 지원 로케일

각 스토어에서 지원하는 모든 언어를 지원합니다.

| 통합  | App Store | Google Play |
| ----- | --------- | ----------- |
| en-US | en-US     | en-US       |
| ko-KR | ko        | ko-KR       |
| ja-JP | ja        | ja-JP       |
| zh-CN | zh-Hans   | zh-CN       |
| zh-TW | zh-Hant   | zh-TW       |
| de-DE | de-DE     | de-DE       |
| fr-FR | fr-FR     | fr-FR       |
| es-ES | es-ES     | es-ES       |
| pt-BR | pt-BR     | pt-BR       |
| ...   | ...       | ...         |

## 라이선스

MIT

---

## 🌐 Pabal Web

ASO와 SEO를 함께 관리하고 싶으신가요? **Pabal Web**을 확인해보세요.

[![Pabal Web](../public/pabal-web.png)](https://pabal.quartz.best/)

**Pabal Web**은 Next.js 기반 웹 인터페이스로, ASO, SEO, Google Search Console 인덱싱 등을 통합 관리하는 완전한 솔루션을 제공합니다.

👉 [Pabal Web 방문](https://pabal.quartz.best/)
