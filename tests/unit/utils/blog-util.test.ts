import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  buildBlogHtmlDocument,
  buildBlogMeta,
  findExistingBlogPosts,
} from "../../../src/utils/blog.util.js";
import {
  createBlogHtmlInputSchema,
  createBlogHtmlTool,
} from "../../../src/tools/content/create-blog-html.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blog-util-"));

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("buildBlogMeta", () => {
  it("treats missing status as published without serializing a default", () => {
    const meta = buildBlogMeta({
      title: "Published Post",
      description: "A published post",
      appSlug: "example-app",
      slug: "published-post",
      locale: "en-US",
      topic: "release notes",
      publishedAt: "2026-06-14",
    });

    assert.equal(meta.status, undefined);
  });

  it("serializes draft status only when explicitly requested", () => {
    const meta = buildBlogMeta({
      title: "Draft Post",
      description: "A draft post",
      appSlug: "example-app",
      slug: "draft-post",
      locale: "en-US",
      topic: "release notes",
      status: "draft",
      publishedAt: "2026-06-14",
    });

    assert.equal(meta.status, "draft");
  });
});

describe("createBlogHtmlTool", () => {
  it("accepts draft status at the MCP tool input boundary", () => {
    const input = createBlogHtmlInputSchema.parse({
      topic: "Release notes",
      locale: "en-US",
      content: "<p>Draft body</p>",
      description: "Draft description",
      status: "draft",
    });

    assert.equal(input.status, "draft");
  });

  it("instructs callers to set draft status only when explicitly requested", () => {
    assert.match(createBlogHtmlTool.description, /status="draft"/);
    assert.match(createBlogHtmlTool.description, /explicitly asks for a draft/);
  });
});

describe("findExistingBlogPosts", () => {
  it("excludes draft posts from writing style references", () => {
    const publicDir = path.join(tempDir, "public");
    const publishedDir = path.join(
      publicDir,
      "blogs",
      "example-app",
      "published-post"
    );
    const draftDir = path.join(publicDir, "blogs", "example-app", "draft-post");
    fs.mkdirSync(publishedDir, { recursive: true });
    fs.mkdirSync(draftDir, { recursive: true });

    const publishedMeta = buildBlogMeta({
      title: "Published Post",
      description: "A published post",
      appSlug: "example-app",
      slug: "published-post",
      locale: "en-US",
      topic: "release notes",
      publishedAt: "2026-06-14",
    });
    const draftMeta = buildBlogMeta({
      title: "Draft Post",
      description: "A draft post",
      appSlug: "example-app",
      slug: "draft-post",
      locale: "en-US",
      topic: "release notes",
      status: "draft",
      publishedAt: "2026-06-15",
    });

    fs.writeFileSync(
      path.join(publishedDir, "en-US.html"),
      buildBlogHtmlDocument({
        meta: publishedMeta,
        content: "<p>Published body</p>",
      })
    );
    fs.writeFileSync(
      path.join(draftDir, "en-US.html"),
      buildBlogHtmlDocument({
        meta: draftMeta,
        content: "<p>Draft body</p>",
      })
    );

    const posts = findExistingBlogPosts({
      appSlug: "example-app",
      locale: "en-US",
      publicDir,
    });

    assert.deepEqual(
      posts.map((post) => post.meta.slug),
      ["published-post"]
    );
  });
});
