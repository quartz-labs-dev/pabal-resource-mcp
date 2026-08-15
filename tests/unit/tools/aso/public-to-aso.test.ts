import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import { optimizePngForStoreUpload } from "../../../../src/tools/aso/public-to-aso.js";

describe("optimizePngForStoreUpload", () => {
  it("losslessly recompresses a PNG above the App Store upload threshold", async () => {
    const fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "pabal-app-store-png-")
    );
    const filePath = path.join(fixtureDir, "large.png");

    await sharp({
      create: {
        width: 1600,
        height: 1600,
        channels: 3,
        background: "#123456",
      },
    })
      .png({ compressionLevel: 0 })
      .toFile(filePath);

    const originalPixels = await sharp(filePath).raw().toBuffer();
    const originalSize = fs.statSync(filePath).size;
    const wasOptimized = await optimizePngForStoreUpload(filePath);
    const optimizedSize = fs.statSync(filePath).size;
    const metadata = await sharp(filePath).metadata();
    const optimizedPixels = await sharp(filePath).raw().toBuffer();

    assert.equal(wasOptimized, true);
    assert.ok(originalSize > 5_000_000);
    assert.ok(optimizedSize < originalSize);
    assert.deepEqual(optimizedPixels, originalPixels);
    assert.equal(metadata.width, 1600);
    assert.equal(metadata.height, 1600);
    assert.equal(metadata.hasAlpha, false);
    assert.equal(metadata.isPalette, false);
  });
});
