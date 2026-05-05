import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAsoData } from "../../../src/utils/aso-validation.util.js";
import type { AsoData } from "../../../src/types/aso/index.js";

describe("sanitizeAsoData", () => {
  it("removes App Store invalid invisible characters before pushData is saved", () => {
    const data: AsoData = {
      appStore: {
        defaultLocale: "en-US",
        locales: {
          "en-US": {
            name: "Example",
            subtitle: "Clean\u200B subtitle",
            description: "Feature ▶\uFE0E description",
            keywords: "example,\uFEFFkeyword",
            bundleId: "com.example.app",
            locale: "en-US",
            screenshots: {},
          },
        },
      },
    };

    const { sanitizedData, warnings } = sanitizeAsoData(data);
    assert.ok(sanitizedData.appStore && "locales" in sanitizedData.appStore);

    const locale = sanitizedData.appStore.locales["en-US"];
    assert.equal(locale.subtitle, "Clean subtitle");
    assert.equal(locale.description, "Feature ▶ description");
    assert.equal(locale.keywords, "example,keyword");
    assert.deepEqual(warnings, [
      "Removed invalid characters from App Store [en-US].subtitle",
      "Removed invalid characters from App Store [en-US].keywords",
      "Removed invalid characters from App Store [en-US].description",
    ]);
  });
});
