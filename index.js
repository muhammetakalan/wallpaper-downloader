import { parse } from "muninn";
import fs from "fs";
import path from "path";
import process from "process";

const showHelp = () => {
  console.log(`
USAGE:
  node wallpaper.js [options]

DESCRIPTION:
  Downloads wallpapers from wallpaperswide.com in 1920x1080 resolution.
  Saves all files into the "downloads/" folder in the current directory.

OPTIONS:
  --start <number>    Starting page (default: 1)
  --end <number>      Ending page (default: 1)
  --help              Display this help message

EXAMPLES:
  node wallpaper.js
  node wallpaper.js --start 1 --end 3
`);
};

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  showHelp();
  process.exit(0);
}

let start = 1;
let end = 1;

const startIndex = args.indexOf("--start");
const endIndex = args.indexOf("--end");

if (startIndex !== -1) start = parseInt(args[startIndex + 1], 10) || 1;
if (endIndex !== -1) end = parseInt(args[endIndex + 1], 10) || start;

if (start > end) {
  console.error("❌ Invalid range: start cannot be greater than end.");
  process.exit(1);
}

const downloadsDir = path.join(process.cwd(), "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

const fetchHTML = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

const downloadImage = async (url, filePath) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
};

const scrapePage = async (page) => {
  const url =
    page === 1
      ? "https://wallpaperswide.com/"
      : `https://wallpaperswide.com/page/${page}`;
  const html = await fetchHTML(url);
  const parsed = await parse(html, {
    schema: {
      wallpapers: {
        selector: ".wall",
        type: "array",
        schema: { link: { selector: "a", attr: "href" } },
      },
    },
  });

  const wallpapers = parsed.wallpapers || [];
  console.log(`📄 Page ${page}: ${wallpapers.length} wallpapers found`);

  if (wallpapers.length === 0) return 0;

  for (const [i, w] of wallpapers.entries()) {
    try {
      const detailHTML = await fetchHTML(`https://wallpaperswide.com${w.link}`);
      const d = await parse(detailHTML, {
        schema: {
          downloadLink: {
            selector: "a[target='_self'][href$='1920x1080.jpg']",
            attr: "href",
          },
        },
      });

      if (!d.downloadLink) continue;
      const fileName = d.downloadLink.split("/").pop();
      const filePath = path.join(downloadsDir, fileName);
      await downloadImage(`https://wallpaperswide.com${d.downloadLink}`, filePath);

      console.log(`[${i + 1}/${wallpapers.length}] ${fileName}`);
    } catch {}
  }

  return wallpapers.length;
};

const main = async () => {
  console.log(`🔍 Fetching wallpapers from page ${start} to ${end}...\n`);

  let total = 0;

  for (let page = start; page <= end; page++) {
    try {
      const downloaded = await scrapePage(page);
      total += downloaded;
      if (page < end) await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.log(`❌ Page ${page} failed: ${err.message}`);
    }
  }

  console.log(`\n🎉 Done! ${total} wallpapers saved in "${downloadsDir}".`);
};

main().catch((err) => console.error("💥 Error:", err.message));
