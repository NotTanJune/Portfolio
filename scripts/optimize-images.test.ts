import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { convertToWebp } from "./optimize-images";

const temporaryDirectories: string[] = [];
const preset = { quality: 85, maxWidth: 1200, maxHeight: 800 };

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("convertToWebp", () => {
  test("converts an image and removes the source after a verified write", async () => {
    const directory = await mkdtemp(join(tmpdir(), "portfolio-images-"));
    temporaryDirectories.push(directory);
    const inputPath = join(directory, "sample.png");
    const outputPath = join(directory, "sample.webp");

    await Bun.write(
      inputPath,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );

    const result = await convertToWebp(inputPath, preset);

    expect(result.status).toBe("converted");
    expect(await Bun.file(inputPath).exists()).toBe(false);
    expect(await Bun.file(outputPath).exists()).toBe(true);
    expect((await new Bun.Image(outputPath).metadata()).format).toBe("webp");
  });

  test("keeps an existing WebP unchanged", async () => {
    const directory = await mkdtemp(join(tmpdir(), "portfolio-images-"));
    temporaryDirectories.push(directory);
    const inputPath = join(directory, "sample.webp");
    await Bun.write(inputPath, "existing");

    const result = await convertToWebp(inputPath, preset);

    expect(result.status).toBe("skipped");
    expect(await Bun.file(inputPath).text()).toBe("existing");
  });
});
