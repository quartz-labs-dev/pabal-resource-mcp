import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadAsoFromConfig } from "../../../src/utils/aso-converter.js";

interface ProductFixtureOptions {
  hasAndroidScreenshots: boolean;
  hasWearOsScreenshots?: boolean;
}

const writeJson = (filePath: string, value: object): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const writeScreenshot = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "fixture");
};

const createProductFixture = ({
  hasAndroidScreenshots,
  hasWearOsScreenshots = false,
}: ProductFixtureOptions): { productsDir: string; slug: string } => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "pabal-aso-converter-")
  );
  const productsDir = path.join(fixtureRoot, "products");
  const slug = "example";
  const productDir = path.join(productsDir, slug);

  writeJson(path.join(productDir, "config.json"), {
    slug,
    bundleId: "com.example.app",
    packageName: "com.example.app",
    content: { defaultLocale: "en-US" },
    metadata: {
      screenshots: {
        phone: [`/products/${slug}/screenshots/en-US/phone/1.png`],
        tablet: [`/products/${slug}/screenshots/en-US/tablet/1.png`],
        watch: [`/products/${slug}/screenshots/en-US/watch/1.png`],
      },
    },
  });
  writeJson(path.join(productDir, "locales", "en-US.json"), {
    aso: {
      title: "Example",
      subtitle: "Example subtitle",
      shortDescription: "Example short description",
      template: { intro: "Intro", outro: "Outro" },
    },
  });

  writeScreenshot(
    path.join(productDir, "screenshots", "en-US", "phone", "1.png")
  );
  writeScreenshot(
    path.join(productDir, "screenshots", "en-US", "tablet", "1.png")
  );
  writeScreenshot(
    path.join(productDir, "screenshots", "en-US", "watch", "1.png")
  );

  if (hasAndroidScreenshots) {
    writeScreenshot(
      path.join(productDir, "screenshots", "en-US", "android", "phone", "2.png")
    );
    writeScreenshot(
      path.join(
        productDir,
        "screenshots",
        "en-US",
        "android",
        "tablet",
        "2.png"
      )
    );
  }

  if (hasWearOsScreenshots) {
    writeScreenshot(
      path.join(productDir, "screenshots", "en-US", "wear-os", "1.png")
    );
  }

  return { productsDir, slug };
};

describe("loadAsoFromConfig screenshot routing", () => {
  it("uses Android-specific screenshots while keeping Watch App Store-only", () => {
    const { productsDir, slug } = createProductFixture({
      hasAndroidScreenshots: true,
    });

    const result = loadAsoFromConfig(slug, productsDir);
    assert.ok(result.googlePlay && "locales" in result.googlePlay);
    assert.ok(result.appStore && "locales" in result.appStore);

    assert.deepEqual(result.googlePlay.locales["en-US"].screenshots, {
      phone: ["/products/example/screenshots/en-US/android/phone/2.png"],
      tablet: ["/products/example/screenshots/en-US/android/tablet/2.png"],
    });
    assert.deepEqual(result.appStore.locales["en-US"].screenshots, {
      iphone65: ["/products/example/screenshots/en-US/phone/1.png"],
      ipad13: ["/products/example/screenshots/en-US/tablet/1.png"],
      appleWatch: ["/products/example/screenshots/en-US/watch/1.png"],
    });
  });

  it("routes Wear OS captures to Google Play and never to the App Store", () => {
    const { productsDir, slug } = createProductFixture({
      hasAndroidScreenshots: false,
      hasWearOsScreenshots: true,
    });

    const result = loadAsoFromConfig(slug, productsDir);
    assert.ok(result.googlePlay && "locales" in result.googlePlay);
    assert.ok(result.appStore && "locales" in result.appStore);

    assert.deepEqual(result.googlePlay.locales["en-US"].screenshots, {
      phone: ["/products/example/screenshots/en-US/phone/1.png"],
      tablet: ["/products/example/screenshots/en-US/tablet/1.png"],
      wear: ["/products/example/screenshots/en-US/wear-os/1.png"],
    });
    assert.deepEqual(result.appStore.locales["en-US"].screenshots, {
      iphone65: ["/products/example/screenshots/en-US/phone/1.png"],
      ipad13: ["/products/example/screenshots/en-US/tablet/1.png"],
      appleWatch: ["/products/example/screenshots/en-US/watch/1.png"],
    });
  });

  it("falls back to shared screenshots when Android-specific folders are absent", () => {
    const { productsDir, slug } = createProductFixture({
      hasAndroidScreenshots: false,
    });

    const result = loadAsoFromConfig(slug, productsDir);
    assert.ok(result.googlePlay && "locales" in result.googlePlay);

    assert.deepEqual(result.googlePlay.locales["en-US"].screenshots, {
      phone: ["/products/example/screenshots/en-US/phone/1.png"],
      tablet: ["/products/example/screenshots/en-US/tablet/1.png"],
    });
  });
});

describe("loadAsoFromConfig Mac App Store block", () => {
  const createMacFixture = (): { productsDir: string; slug: string } => {
    const { productsDir, slug } = createProductFixture({
      hasAndroidScreenshots: false,
    });
    const productDir = path.join(productsDir, slug);

    writeScreenshot(path.join(productDir, "screenshots", "en-US", "mac", "1.png"));
    writeScreenshot(path.join(productDir, "screenshots", "en-US", "mac", "2.png"));
    writeJson(path.join(productDir, "locales", "en-US.json"), {
      aso: {
        title: "Example",
        subtitle: "Example subtitle",
        template: { intro: "iPhone intro", outro: "Outro" },
      },
      platforms: {
        macos: {
          description: "Mac description",
          keywords: ["mac", "menubar"],
          promotionalText: "Mac promo",
        },
      },
    });
    writeJson(path.join(productDir, "locales", "ko-KR.json"), {
      aso: {
        title: "예시",
        template: { intro: "인트로", outro: "아웃트로" },
      },
    });

    return { productsDir, slug };
  };

  it("carries Mac copy and rendered Mac screenshots only on the App Store", () => {
    const { productsDir, slug } = createMacFixture();

    const result = loadAsoFromConfig(slug, productsDir);
    assert.ok(result.appStore && "locales" in result.appStore);
    assert.ok(result.googlePlay && "locales" in result.googlePlay);

    assert.deepEqual(result.appStore.locales["en-US"].macOS, {
      description: "Mac description",
      keywords: "mac,menubar",
      promotionalText: "Mac promo",
      screenshots: {
        mac: [
          "/products/example/screenshots/en-US/mac/1.png",
          "/products/example/screenshots/en-US/mac/2.png",
        ],
      },
    });
    assert.ok(
      !result.appStore.locales["en-US"].description.includes("Mac description")
    );
    assert.equal(
      "mac" in result.googlePlay.locales["en-US"].screenshots,
      false
    );
  });

  it("leaves out the Mac block for a locale with no Mac copy or Mac folder", () => {
    const { productsDir, slug } = createMacFixture();

    const result = loadAsoFromConfig(slug, productsDir);
    assert.ok(result.appStore && "locales" in result.appStore);

    assert.equal("macOS" in result.appStore.locales["ko-KR"], false);
  });
});
