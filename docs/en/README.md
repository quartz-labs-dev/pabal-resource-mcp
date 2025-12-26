# pabal-web-mcp Documentation

MCP (Model Context Protocol) server for bidirectional conversion between ASO (App Store Optimization) and web SEO data.

This library enables seamless reuse of ASO data for web SEO purposes, allowing you to convert ASO metadata directly into web SEO content and vice versa. **Build your own synced website** based on ASO data from App Store Connect and Google Play Console, keeping your app store listings and web presence perfectly synchronized.

> 💡 **Example**: Check out [labs.quartz.best](https://labs.quartz.best/) to see a live website built with this library, where app store data is automatically synced to create a beautiful, SEO-optimized web presence.

## 🛠️ Installation

### Requirements

- Node.js >= 18
- [pabal-mcp](https://github.com/quartz-labs-dev/pabal-mcp) must be installed and configured

### Install as Library

Install this library in your website project:

```bash
npm install pabal-web-mcp
# or
yarn add pabal-web-mcp
# or
pnpm add pabal-web-mcp
```

### MCP Client Configuration

> **Note**: The `mcp-appstore` server is required for keyword research functionality. Make sure to install dependencies first: `cd external-tools/mcp-appstore && npm install`

#### Install in Cursor

Add to `~/.cursor/mcp.json` (global) or project `.cursor/mcp.json`:

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
        "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"
      ],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "pabal-web-mcp"
    },
    "mcp-appstore": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"
      ],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

#### Install in VS Code

Example `settings.json` MCP section:

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
      "args": ["/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

Or if installed globally:

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
      "args": ["/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

#### Install in Claude Code

> [!TIP]
> See the [official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp#setting-up-enterprise-mcp-configuration) for detailed configuration options.

Add to Claude Code MCP settings (JSON format):

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
        "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"
      ],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "pabal-web-mcp": {
      "command": "pabal-web-mcp"
    },
    "mcp-appstore": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"
      ],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

#### Install in Windsurf

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
        "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore/server.js"
      ],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore"
    }
  }
}
```

## 🔐 Configure Credentials

pabal-web-mcp uses the configuration file from `pabal-mcp`. For detailed credential setup instructions (App Store Connect API keys, Google Play service accounts, etc.), please refer to the [pabal-mcp README](https://github.com/quartz-labs-dev/pabal-mcp?tab=readme-ov-file#-configure-credentials).

### ⚠️ Important: Set dataDir Path

**You must set `dataDir` in `~/.config/pabal-mcp/config.json` to the absolute path where your `pabal-web` project is stored on your local machine.**

```json
{
  "dataDir": "/ABSOLUTE/PATH/TO/pabal-web",
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

Examples:

- macOS: `"/Users/username/projects/pabal-web"`
- Linux: `"/home/username/projects/pabal-web"`
- Windows: `"C:\\Users\\username\\projects\\pabal-web"`

## MCP Server

This package includes an MCP server for managing ASO data through Claude or other MCP-compatible clients.

### Available Tools

| Tool               | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `aso-to-public`    | Convert ASO data to public config format                 |
| `public-to-aso`    | Convert public config to ASO data format                 |
| `keyword-research` | Plan/persist ASO keyword research (.aso/keywordResearch) |
| `improve-public`   | Improve product locale content with AI suggestions       |
| `init-project`     | Initialize a new product project structure               |
| `create-blog-html` | Generate static HTML blog posts with BLOG_META headers   |

### Using external keyword MCP ([appreply-co/mcp-appstore](https://github.com/appreply-co/mcp-appstore))

The `mcp-appstore` server provides keyword research capabilities that work with `keyword-research` tool. To use it:

1. Install deps in the existing clone: `cd external-tools/mcp-appstore && npm install`
2. Register `mcp-appstore` in your MCP client (see configuration examples above)
3. Use it with `keyword-research` (saves to `.aso/keywordResearch/...`) before `improve-public` to supply keyword data.

> **Note**: If your MCP client allows, let the LLM start this process before keyword research and stop it after; otherwise start/stop it manually.

### Supported Locales

Supports all languages supported by each store.

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

## License

MIT

---

## 🌐 Pabal Web

Want to manage ASO and SEO together? Check out **Pabal Web**.

[![Pabal Web](../public/pabal-web.png)](https://pabal.quartz.best/)

**Pabal Web** is a Next.js-based web interface that provides a complete solution for unified management of ASO, SEO, Google Search Console indexing, and more.

👉 [Visit Pabal Web](https://pabal.quartz.best/)
