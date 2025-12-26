# Apps Tools

Tools for app and project management.

## Tools

### init-project

Guides the initial project setup workflow.

**Input:**
- `slug` (optional): Product slug to focus on

**Output:**
- Setup checklist
- Required steps for initialization
- Conversion workflow guide

**Workflow:**
1. Ensure `pabal-mcp init` has been run
2. Verify `.aso/pullData/products/[slug]/` exists
3. Convert ASO data to public format
4. Validate outputs

---

### search-app

Searches registered apps from configuration.

**Input:**
- `query` (optional): Search term (slug, bundleId, packageName, name)
- `store` (optional): Filter by `appStore`, `googlePlay`, or `all`

**Output:**
- Matching app list with details
- Bundle IDs and package names
- Supported locales

**Usage:**
- Without query: Returns all registered apps
- With query: Filters by slug, bundleId, packageName, or name
