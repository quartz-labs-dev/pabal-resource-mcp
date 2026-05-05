import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareAsoDataForPush } from "../../../../src/tools/aso/utils/push/prepare-aso-data-for-push.util.js";
import type { AsoData } from "../../../../src/types/aso/index.js";

describe("prepareAsoDataForPush", () => {
  it("preserves App Store app-level URLs and applies them as locale fallbacks", () => {
    const data: AsoData = {
      appStore: {
        defaultLocale: "en-US",
        contactEmail: "support@example.com",
        supportUrl: "https://example.com/support",
        marketingUrl: "https://example.com",
        privacyPolicyUrl: "https://example.com/privacy",
        termsUrl: "https://example.com/terms",
        locales: {
          "en-US": {
            name: "Example",
            subtitle: "Example subtitle",
            description: "Example description",
            keywords: "example",
            bundleId: "com.example.app",
            locale: "en-US",
            screenshots: {
              iphone65: ["app-store/screenshots/en-US/iphone65-1.png"],
            },
          },
        },
      },
    };

    const result = prepareAsoDataForPush(data);
    const appStore = result.appStore;

    assert.ok(appStore && "locales" in appStore);
    assert.equal(appStore.contactEmail, "support@example.com");
    assert.equal(appStore.supportUrl, "https://example.com/support");
    assert.equal(appStore.marketingUrl, "https://example.com");
    assert.equal(appStore.privacyPolicyUrl, "https://example.com/privacy");
    assert.equal(appStore.termsUrl, "https://example.com/terms");

    const locale = appStore.locales["en-US"];
    assert.equal(locale.supportUrl, "https://example.com/support");
    assert.equal(locale.marketingUrl, "https://example.com");
    assert.equal(locale.privacyPolicyUrl, "https://example.com/privacy");
    assert.equal(locale.termsUrl, "https://example.com/terms");
  });

  it("does not overwrite App Store locale-specific URLs", () => {
    const data: AsoData = {
      appStore: {
        defaultLocale: "en-US",
        supportUrl: "https://example.com/support",
        marketingUrl: "https://example.com",
        privacyPolicyUrl: "https://example.com/privacy",
        termsUrl: "https://example.com/terms",
        locales: {
          "en-US": {
            name: "Example",
            description: "Example description",
            bundleId: "com.example.app",
            locale: "en-US",
            supportUrl: "https://en.example.com/support",
            marketingUrl: "https://en.example.com",
            privacyPolicyUrl: "https://en.example.com/privacy",
            termsUrl: "https://en.example.com/terms",
            screenshots: {},
          },
        },
      },
    };

    const result = prepareAsoDataForPush(data);
    const appStore = result.appStore;

    assert.ok(appStore && "locales" in appStore);
    const locale = appStore.locales["en-US"];
    assert.equal(locale.supportUrl, "https://en.example.com/support");
    assert.equal(locale.marketingUrl, "https://en.example.com");
    assert.equal(locale.privacyPolicyUrl, "https://en.example.com/privacy");
    assert.equal(locale.termsUrl, "https://en.example.com/terms");
  });
});
