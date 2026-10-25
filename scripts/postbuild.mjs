import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputPublicDir = path.join(rootDir, ".output", "public");
const distDir = path.join(rootDir, "dist");

console.log("[postbuild] Preparing dist/ directory for deployment...");

// 1. Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 2. Copy all files from .output/public into dist
if (fs.existsSync(outputPublicDir)) {
  fs.cpSync(outputPublicDir, distDir, { recursive: true });
  console.log(`[postbuild] Copied .output/public to dist/`);
} else {
  console.warn(`[postbuild] Warning: .output/public not found.`);
}

// 3. Find built CSS and JS assets
const assetsDir = path.join(distDir, "assets");
let cssFile = "";
let clientJsFile = "";
let indexJsFile = "";

if (fs.existsSync(assetsDir)) {
  const assetFiles = fs.readdirSync(assetsDir);
  cssFile = assetFiles.find((f) => f.endsWith(".css")) || "";
  clientJsFile = assetFiles.find((f) => f.startsWith("client-") && f.endsWith(".js")) || "";
  indexJsFile = assetFiles.find((f) => f.startsWith("index-") && f.endsWith(".js")) || "";
}

// 4. Generate dist/index.html if missing
const indexHtmlPath = path.join(distDir, "index.html");
if (!fs.existsSync(indexHtmlPath)) {
  const cssTag = cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}" />` : "";
  const scriptTag = clientJsFile
    ? `<script type="module" src="/assets/${clientJsFile}"></script>`
    : indexJsFile
      ? `<script type="module" src="/assets/${indexJsFile}"></script>`
      : "";

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VÉSTARA — Your Personal AI Style Agent</title>
    <meta name="description" content="Personalised, occasion-aware outfits built from the clothes you already own." />
    <meta property="og:title" content="VÉSTARA — Your Personal AI Style Agent" />
    <meta property="og:description" content="Personalised, occasion-aware outfits built from the clothes you already own." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap" />
    ${cssTag}
  </head>
  <body class="bg-background text-foreground antialiased selection:bg-bronze/20 selection:text-bronze">
    <div id="root">
      <header class="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a class="font-display text-xl tracking-[0.18em] text-foreground hover:opacity-80 transition-opacity" href="/">VÉSTARA</a>
          <nav class="flex items-center gap-6 text-sm text-muted-foreground">
            <a class="hover:text-foreground transition-colors" href="/wardrobe">Wardrobe</a>
            <a class="hover:text-foreground transition-colors" href="/stylist">AI Stylist</a>
            <a class="hover:text-foreground transition-colors" href="/try-on">Virtual Try-On</a>
            <a class="hover:text-foreground transition-colors" href="/profile">Profile</a>
            <a class="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-bronze transition-colors" href="/auth">Sign In</a>
          </nav>
        </div>
      </header>
      <main class="mx-auto max-w-6xl px-5 py-16 text-center">
        <span class="inline-block rounded-full border border-border/80 bg-secondary/60 px-3.5 py-1 text-xs tracking-wider uppercase text-muted-foreground">AI Fashion Atelier</span>
        <h1 class="mt-6 font-display text-5xl md:text-7xl font-normal tracking-tight text-foreground">Dressing well, made effortless.</h1>
        <p class="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">Personalised, occasion-aware outfits and virtual 3D try-on built from the clothes you already own.</p>
        <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a class="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lift hover:bg-bronze transition-all" href="/auth">Get Started</a>
          <a class="rounded-full border border-input bg-background px-8 py-3 text-sm font-semibold hover:bg-accent transition-all" href="/try-on">Try On 3D Studio</a>
        </div>
      </main>
    </div>
    ${scriptTag}
  </body>
</html>`;

  fs.writeFileSync(indexHtmlPath, htmlContent, "utf8");
  console.log(`[postbuild] Generated dist/index.html`);
}

// 5. Create SPA fallback 404.html for direct route refreshes
const notFoundHtmlPath = path.join(distDir, "404.html");
if (!fs.existsSync(notFoundHtmlPath) && fs.existsSync(indexHtmlPath)) {
  fs.copyFileSync(indexHtmlPath, notFoundHtmlPath);
  console.log(`[postbuild] Generated dist/404.html for SPA routing`);
}

console.log("[postbuild] dist/ prepared successfully.");
