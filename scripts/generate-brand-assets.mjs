import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

// One set of outlined paths drives the UI, downloadable artwork and app icons.
const root = fileURLToPath(new URL("../", import.meta.url));
const artwork = JSON.parse(await readFile(path.join(root, "config/brand-artwork.json"), "utf8"));
const output = path.join(root, "public/brand");
await mkdir(output, { recursive: true });
const markPaths = artwork.mark.paths.map(d => `<path d="${d}"/>`).join("");
const colors = { terracotta: "#B94E3C", peach: "#F29B82", ink: "#30231E", cream: "#FFFAF5" };
const svg = (viewBox, content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>\n`;
const lockup = (ink, accent) => svg("0 0 230 48", `<title>Kenangin.id</title><g fill="${accent}">${markPaths}</g><svg x="60" y="11" width="164" height="31.914" viewBox="${artwork.wordmark.viewBox}" fill="${ink}"><path d="${artwork.wordmark.name}"/><path fill="${accent}" d="${artwork.wordmark.suffix}"/></svg>`);
const icon = (radius = 14) => svg("0 0 64 64", `<rect width="64" height="64" rx="${radius}" fill="${colors.terracotta}"/><g transform="translate(2 1) scale(1.25)" fill="${colors.cream}">${markPaths}</g>`);

for (const [name, content] of [
  ["kenangin-mark.svg", svg(artwork.mark.viewBox, `<title>Kenangin.id</title><g fill="${colors.terracotta}">${markPaths}</g>`)],
  ["kenangin-logo.svg", lockup(colors.ink, colors.terracotta)],
  ["kenangin-logo-light.svg", lockup(colors.cream, colors.peach)],
  ["kenangin-logo-mono.svg", lockup("currentColor", "currentColor")],
]) {
  await writeFile(path.join(output, name), content);
}

await sharp(Buffer.from(lockup(colors.ink, colors.terracotta))).resize(1150, 240).png().toFile(path.join(output, "kenangin-logo.png"));
await sharp(Buffer.from(icon())).resize(512, 512).png().toFile(path.join(output, "kenangin-icon.png"));
await writeFile(path.join(root, "app/icon.svg"), icon());
await sharp(Buffer.from(icon(0))).resize(180, 180).png().toFile(path.join(root, "app/apple-icon.png"));

// ICO supports PNG entries; include native sizes so small tabs stay crisp.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(Buffer.from(icon())).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((buffer, i) => {
  const entry = 6 + i * 16;
  header[entry] = sizes[i];
  header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(buffer.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += buffer.length;
});
await writeFile(path.join(root, "app/favicon.ico"), Buffer.concat([header, ...images]));
console.log("Generated Kenangin.id logos, SVG favicon, ICO (16/32/48) and Apple icon (180).");
