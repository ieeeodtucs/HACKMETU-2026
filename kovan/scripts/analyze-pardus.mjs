import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";

const OUT = "scripts/pardus-analysis";
mkdirSync(OUT, { recursive: true });

async function main() {
  console.log("1. Starting browser...");
  const browser = await chromium.launch({ headless: true });
  console.log("2. Browser launched");
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  console.log("3. Navigating...");

  await page.goto("https://pardus.org.tr/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log("4. Page loaded");

  // Full page screenshot
  await page.screenshot({ path: `${OUT}/fullpage.png`, fullPage: true });
  console.log("5. Full page screenshot saved");

  // Hero screenshot
  await page.screenshot({ path: `${OUT}/hero.png` });
  console.log("6. Hero screenshot saved");

  // Scroll captures
  for (const y of [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/scroll-${y}.png` });
    console.log(`7. Screenshot at ${y}px`);
  }

  // Design analysis
  const designData = await page.evaluate(() => {
    const data = {};

    const bodyStyles = getComputedStyle(document.body);
    data.body = {
      fontFamily: bodyStyles.fontFamily,
      fontSize: bodyStyles.fontSize,
      color: bodyStyles.color,
      background: bodyStyles.backgroundColor,
    };

    const allElements = document.querySelectorAll("*");
    const fonts = new Set();
    const colors = new Set();
    const bgColors = new Set();

    allElements.forEach((el) => {
      const s = getComputedStyle(el);
      fonts.add(s.fontFamily);
      if (s.color !== "rgba(0, 0, 0, 0)") colors.add(s.color);
      if (s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent")
        bgColors.add(s.backgroundColor);
    });

    data.fonts = [...fonts];
    data.colors = [...colors].slice(0, 30);
    data.bgColors = [...bgColors].slice(0, 30);

    // Headings
    const headings = [];
    document.querySelectorAll("h1, h2, h3").forEach((h) => {
      headings.push({
        tag: h.tagName,
        text: h.textContent?.trim().slice(0, 100),
        fontSize: getComputedStyle(h).fontSize,
        fontWeight: getComputedStyle(h).fontWeight,
        fontFamily: getComputedStyle(h).fontFamily,
        color: getComputedStyle(h).color,
      });
    });
    data.headings = headings;

    // Stylesheets
    const stylesheets = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      stylesheets.push(link.href);
    });
    data.stylesheets = stylesheets;

    // Sections
    const sectionData = [];
    document.querySelectorAll("section, [class*='section']").forEach((sec) => {
      const s = getComputedStyle(sec);
      sectionData.push({
        classes: sec.className,
        bg: s.backgroundColor,
        padding: s.padding,
        text: sec.textContent?.trim().slice(0, 200),
      });
    });
    data.sections = sectionData.slice(0, 15);

    // Buttons
    const buttons = [];
    document.querySelectorAll("button, a[class*='btn'], [class*='button']").forEach((btn) => {
      const s = getComputedStyle(btn);
      buttons.push({
        text: btn.textContent?.trim().slice(0, 50),
        bg: s.backgroundColor,
        color: s.color,
        borderRadius: s.borderRadius,
        padding: s.padding,
        fontSize: s.fontSize,
      });
    });
    data.buttons = buttons.slice(0, 10);

    // Nav
    const nav = document.querySelector("nav, header, [class*='nav'], [class*='header']");
    if (nav) {
      data.nav = { classes: nav.className, html: nav.outerHTML.slice(0, 3000) };
    }

    // Page structure
    const structure = [];
    const main = document.querySelector("main, #__next, #app, body > div:first-child") || document.body;
    for (const el of main.children) {
      structure.push(`<${el.tagName.toLowerCase()} class="${el.className}"> — ${el.textContent?.trim().slice(0, 80)}`);
    }
    data.pageStructure = structure;

    // Images
    const images = [];
    document.querySelectorAll("img").forEach((img) => {
      if (img.src && !img.src.startsWith("data:")) {
        images.push({ src: img.src, alt: img.alt });
      }
    });
    data.images = images.slice(0, 20);

    return data;
  });

  writeFileSync(`${OUT}/design-analysis.json`, JSON.stringify(designData, null, 2));
  console.log("8. Design analysis saved");

  // Inline CSS
  const allCSS = await page.evaluate(() => {
    const css = [];
    document.querySelectorAll("style").forEach((style) => {
      css.push(style.textContent || "");
    });
    return css.join("\n\n");
  });
  writeFileSync(`${OUT}/inline-styles.css`, allCSS);
  console.log("9. Inline CSS saved");

  await browser.close();
  console.log("\n✅ Done! Check scripts/pardus-analysis/");
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
