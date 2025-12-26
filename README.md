# pabal-web-mcp

MCP server for ASO ↔ Web SEO data conversion.

Build synced websites from App Store Connect and Google Play Console data.

> 💡 **Example**: [labs.quartz.best](https://labs.quartz.best/)

[![Documentation](https://img.shields.io/badge/docs-English-blue)](./docs/en/README.md) [![한국어](https://img.shields.io/badge/docs-한국어-green)](./docs/ko/README.md)

## Installation

```bash
npm install pabal-web-mcp
```

**Requirements:** Node.js >= 18, [pabal-mcp](https://github.com/quartz-labs-dev/pabal-mcp)

## MCP Configuration

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

For keyword research, add `mcp-appstore`:

```json
{
  "mcp-appstore": {
    "command": "node",
    "args": ["/PATH/TO/external-tools/mcp-appstore/server.js"],
    "cwd": "/PATH/TO/external-tools/mcp-appstore"
  }
}
```

## Configuration

Set `dataDir` in `~/.config/pabal-mcp/config.json`:

```json
{
  "dataDir": "/path/to/pabal-web"
}
```

See [pabal-mcp](https://github.com/quartz-labs-dev/pabal-mcp) for credential setup.

## Tools

| Category | Tools |
|----------|-------|
| ASO | `aso-to-public`, `public-to-aso`, `improve-public`, `validate-aso`, `keyword-research` |
| Apps | `init-project`, `search-app` |
| Content | `create-blog-html` |

See [documentation](./docs/en/README.md) for details.

## License

MIT

---

## Pabal Web

[![Pabal Web](public/pabal-web.png)](https://pabal.quartz.best/)

Unified ASO + SEO management interface. [Visit →](https://pabal.quartz.best/)
