import { extname, join, parse } from "node:path";
import { readdir, rm } from "node:fs/promises";

const INPUT_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".bmp",
  ".gif",
  ".tiff",
  ".tif",
  ".heic",
  ".heif",
  ".avif",
  ".webp",
]);

export interface ImagePreset {
  quality: number;
  maxWidth: number;
  maxHeight: number;
}

export interface OptimizationResult {
  inputPath: string;
  outputPath: string;
  status: "converted" | "skipped";
}

const PRESETS: Record<string, ImagePreset> = {
  profile: { quality: 72, maxWidth: 800, maxHeight: 800 },
  projects: { quality: 85, maxWidth: 1200, maxHeight: 800 },
  logos: { quality: 85, maxWidth: 160, maxHeight: 160 },
};

export async function convertToWebp(
  inputPath: string,
  preset: ImagePreset,
): Promise<OptimizationResult> {
  if (typeof Bun.Image !== "function") {
    throw new Error("Bun 1.4 or newer is required for native image optimization");
  }

  const extension = extname(inputPath).toLowerCase();
  const parsed = parse(inputPath);
  const outputPath = join(parsed.dir, `${parsed.name}.webp`);

  if (extension === ".webp" || (await Bun.file(outputPath).exists())) {
    if (extension !== ".webp") await rm(inputPath);
    return { inputPath, outputPath, status: "skipped" };
  }

  const image = new Bun.Image(Bun.file(inputPath), {
    autoOrient: true,
    maxPixels: 268_402_689,
  });

  const bytesWritten = await image
    .resize(preset.maxWidth, preset.maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
      filter: "lanczos3",
    })
    .webp({ quality: preset.quality })
    .write(outputPath);

  if (bytesWritten <= 0 || !(await Bun.file(outputPath).exists())) {
    throw new Error(`Bun.Image did not create ${outputPath}`);
  }

  await rm(inputPath);
  return { inputPath, outputPath, status: "converted" };
}

async function optimizeGroup(
  baseDirectory: string,
  group: string,
  preset: ImagePreset,
): Promise<OptimizationResult[]> {
  const directory = join(baseDirectory, group);
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error?.code === "ENOENT") return [];
      throw error;
    },
  );
  const imagePaths = entries
    .filter(
      (entry) =>
        entry.isFile() && INPUT_EXTENSIONS.has(extname(entry.name).toLowerCase()),
    )
    .map((entry) => join(directory, entry.name));

  console.log(`Optimizing ${group} images with Bun.Image...`);
  return Promise.all(imagePaths.map((path) => convertToWebp(path, preset)));
}

export async function optimizeImages(baseDirectory: string): Promise<void> {
  const startedAt = performance.now();
  const results = (
    await Promise.all(
      Object.entries(PRESETS).map(([group, preset]) =>
        optimizeGroup(baseDirectory, group, preset),
      ),
    )
  ).flat();

  const converted = results.filter((result) => result.status === "converted");
  const skipped = results.length - converted.length;

  for (const result of converted) {
    console.log(
      `Converted ${parse(result.inputPath).base} -> ${parse(result.outputPath).base}`,
    );
  }

  console.log(
    `Image optimization complete: ${converted.length} converted, ${skipped} skipped, ${results.length} total in ${(performance.now() - startedAt).toFixed(1)}ms`,
  );
}

if (import.meta.main) {
  const baseDirectory = process.argv[2] ??
    join(import.meta.dir, "..", "frontend", "public", "images");

  await optimizeImages(baseDirectory).catch((error) => {
    console.error("Image optimization failed:", error);
    process.exitCode = 1;
  });
}
