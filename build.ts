process.env.NODE_ENV = "production";

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";

import tailwindPlugin from "./plugins/tailwind-plugin";
import solidPlugin from "./plugins/solid-plugin";
import iconifyPlugin from "./plugins/iconify-solid-plugin";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const distWebDir = path.join(ROOT, "dist", "web");
const distAssetsDir = path.join(distWebDir, "assets");

function entryStaticChunks(dir: string, entry: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    let source: string;
    try {
      source = readFileSync(path.join(dir, file), "utf8");
    } catch {
      return;
    }
    for (const match of source.matchAll(/(?:(?:^|[;}\s])import\s*["']|from\s*["'])\.\/([^"']+\.js)["']/g)) {
      walk(match[1]!);
    }
  };
  walk(entry);
  return [...seen];
}

async function build() {
  if (existsSync(distWebDir)) rmSync(distWebDir, { recursive: true, force: true });
  mkdirSync(distAssetsDir, { recursive: true });

  console.log("[build] Bundling MighT SPA...");
  const result = await Bun.build({
    entrypoints: [path.join(ROOT, "web", "src", "main.tsx")],
    outdir: distAssetsDir,
    target: "browser",
    minify: true,
    splitting: true,
    naming: { entry: "[name]-[hash].[ext]", chunk: "chunk-[hash].[ext]", asset: "[name]-[hash].[ext]" },
    sourcemap: "none",
    external: ["/assets/*"],
    plugins: [iconifyPlugin, tailwindPlugin, solidPlugin],
  });

  if (!result.success) {
    console.error("[build] failed:");
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }

  const assetPath = (file: string) => `/assets/${path.basename(file)}`;
  const emittedEntry = result.outputs.find((output) => output.kind === "entry-point");
  if (!emittedEntry) {
    console.error("[build] no JavaScript entry was produced");
    process.exit(1);
  }
  const entryFile = path.basename(emittedEntry.path);

  let emittedStyle = result.outputs.find(
    (output) => output.kind === "asset" && output.path.endsWith(".css"),
  );

  let styleHref: string;
  if (emittedStyle) {
    styleHref = assetPath(emittedStyle.path);
  } else {
    // Compile web/style.tailwindcss.css explicitly if not imported directly in TSX
    const cssInPath = path.join(ROOT, "web", "style.tailwindcss.css");
    const cssSource = readFileSync(cssInPath, "utf8");
    const compiled = await postcss([tailwindcss]).process(cssSource, {
      from: cssInPath,
      to: path.join(distAssetsDir, "style.css"),
    });
    const hash = Bun.hash(compiled.css).toString(16).slice(0, 8);
    const styleFile = `style-${hash}.css`;
    writeFileSync(path.join(distAssetsDir, styleFile), compiled.css);
    styleHref = assetPath(styleFile);
  }

  const preload = entryStaticChunks(distAssetsDir, entryFile).map(assetPath);

  const sourceHtml = readFileSync(path.join(ROOT, "web", "index.html"), "utf8");
  const withoutAssets = sourceHtml
    .replace(/\s*<link rel="stylesheet" href="\.\/style\.tailwindcss\.css" \/>/, "")
    .replace(/\s*<script type="module" src="\.\/src\/main\.tsx"><\/script>/, "");

  const head = [
    `<link rel="stylesheet" crossorigin href="${styleHref}" />`,
    ...preload.map((href) => `<link rel="modulepreload" crossorigin href="${href}" />`),
    `<script type="module" crossorigin src="${assetPath(entryFile)}"></script>`,
  ].join("\n    ");

  const document = withoutAssets.replace("</head>", `    ${head}\n  </head>`);
  writeFileSync(path.join(distWebDir, "index.html"), document);

  const publicDir = path.join(ROOT, "web", "public");
  if (existsSync(publicDir)) {
    cpSync(publicDir, distWebDir, { recursive: true });
  }

  console.log(`[build] OK -> dist/web/ (${result.outputs.length} outputs, css=${styleHref})`);
}

build();
