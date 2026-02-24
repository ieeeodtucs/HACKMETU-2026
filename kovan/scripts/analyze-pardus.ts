const { chromium } = require("playwright");
const { mkdirSync, writeFileSync } = require("fs");

const OUT = "scripts/pardus-analysis";
mkdirSync(OUT, { recursive: true });

async function main() {
  console.log("Starting browser...");
  const browser = await chromium.launch({ headless: true });
  console.log("Browser launched");
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  console.log("Page created, navigating...");

  await page.goto("https://pardus.org.tr/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log("Page loaded");

  // 1) Full page screenshot
  await page.screenshot({ path: `${OUT}/fullpage.png`, fullPage: true });
  console.log("✓ Full page screenshot saved");

  // 2) Viewport screenshot (above the fold)
  await page.screenshot({ path: `${OUT}/hero.png` });
  console.log("✓ Hero screenshot saved");

  // 3) Scroll down and capture sections
  const sections = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];
  for (const y of sections) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/scroll-${y}.png` });
    console.log(`✓ Screenshot at scroll ${y}px`);
  }

  // 4) Extract design details
  const designData = await page.evaluate(() => {
    const data: any = {};

    // Get all computed styles for key elements
    const body = document.body;
    const bodyStyles = getComputedStyle(body);
    data.body = {
      fontFamily: bodyStyles.fontFamily,
      fontSize: bodyStyles.fontSize,
      color: bodyStyles.color,
      background: bodyStyles.backgroundColor,
    };

    // Get all unique font families used
    const allElements = document.querySelectorAll("*");
    const fonts = new Set<string>();
    const colors = new Set<string>();
    const bgColors = new Set<string>();
    const fontSizes = new Set<string>();

    allElements.forEach((el) => {
      const s = getComputedStyle(el);
      fonts.add(s.fontFamily);
      if (s.color !== "rgba(0, 0, 0, 0)") colors.add(s.color);
      if (s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent")
        bgColors.add(s.backgroundColor);
      fontSizes.add(s.fontSize);
    });

    data.fonts = [...fonts];
    data.colors = [...colors].slice(0, 30);
    data.bgColors = [...bgColors].slice(0, 30);
    data.fontSizes = [...fontSizes].sort((a, b) => parseFloat(a) - parseFloat(b));

    // Get nav structure
    const nav = document.querySelector("nav, header, [class*='nav'], [class*='header']");
    if (nav) {
      data.nav = {
        tag: nav.tagName,
        classes: nav.className,
        html: nav.outerHTML.slice(0, 2000),
      };
    }

    // Get hero section
    const hero = document.querySelector(
      "[class*='hero'], [class*='banner'], section:first-of-type, .swiper, [class*='slider']"
    );
    if (hero) {
      data.hero = {
        tag: hero.tagName,
        classes: hero.className,
        text: hero.textContent?.trim().slice(0, 500),
      };
    }

    // Get all section headings
    const headings: any[] = [];
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

    // Get all links in external stylesheets
    const stylesheets: string[] = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      stylesheets.push((link as HTMLLinkElement).href);
    });
    data.stylesheets = stylesheets;

    // Get all images
    const images: any[] = [];
    document.querySelectorAll("img").forEach((img) => {
      if (img.src && !img.src.startsWith("data:")) {
        images.push({
          src: img.src,
          alt: img.alt,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      }
    });
    data.images = images.slice(0, 20);

    // Get sections structure
    const sectionData: any[] = [];
    document.querySelectorAll("section, [class*='section']").forEach((sec) => {
      const s = getComputedStyle(sec);
      sectionData.push({
        classes: (sec as HTMLElement).className,
        bg: s.backgroundColor,
        padding: s.padding,
        text: sec.textContent?.trim().slice(0, 200),
      });
    });
    data.sections = sectionData.slice(0, 15);

    // Get CSS variables from :root
    const rootStyles = getComputedStyle(document.documentElement);
    const cssVars: Record<string, string> = {};
    const sheet = document.styleSheets[0];
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
          for (let i = 0; i < rule.style.length; i++) {
            const prop = rule.style[i];
            if (prop.startsWith("--")) {
              cssVars[prop] = rule.style.getPropertyValue(prop);
            }
          }
        }
      }
    } catch {}
    data.cssVars = cssVars;

    // Button styles
    const buttons: any[] = [];
    document.querySelectorAll("button, a[class*='btn'], [class*='button']").forEach((btn) => {
      const s = getComputedStyle(btn);
      buttons.push({
        text: btn.textContent?.trim().slice(0, 50),
        bg: s.backgroundColor,
        color: s.color,
        borderRadius: s.borderRadius,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        border: s.border,
      });
    });
    data.buttons = buttons.slice(0, 10);

    // Footer
    const footer = document.querySelector("footer, [class*='footer']");
    if (footer) {
      data.footer = {
        classes: (footer as HTMLElement).className,
        bg: getComputedStyle(footer).backgroundColor,
        html: footer.outerHTML.slice(0, 2000),
      };
    }

    // Overall page structure
    const structure: string[] = [];
    document.body.children[0]?.querySelectorAll(":scope > *").forEach((el) => {
      structure.push(
        `<${el.tagName.toLowerCase()} class="${(el as HTMLElement).className}"> — ${el.textContent?.trim().slice(0, 80)}`
      );
    });
    data.pageStructure = structure;

    return data;
  });

  // Write analysis
  const Bun = globalThis.Bun;
  await Bun.write(`${OUT}/design-analysis.json`, JSON.stringify(designData, null, 2));
  console.log("✓ Design analysis saved");

  // 5) Extract all CSS (inline styles and style tags)
  const allCSS = await page.evaluate(() => {
    const css: string[] = [];
    document.querySelectorAll("style").forEach((style) => {
      css.push(style.textContent || "");
    });
    return css.join("\n\n");
  });
  await Bun.write(`${OUT}/inline-styles.css`, allCSS);
  console.log("✓ Inline CSS saved");

  // 6) Get external CSS content
  const cssUrls = await page.evaluate(() => {
    const urls: string[] = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      urls.push((link as HTMLLinkElement).href);
    });
    return urls;
  });

  for (let i = 0; i < Math.min(cssUrls.length, 5); i++) {
    try {
      const resp = await page.evaluate(async (url: string) => {
        const r = await fetch(url);
        return await r.text();
      }, cssUrls[i]);
      await Bun.write(`${OUT}/external-css-${i}.css`, resp);
      console.log(`✓ External CSS ${i} saved: ${cssUrls[i]}`);
    } catch (e) {
      console.log(`✗ Failed to fetch CSS: ${cssUrls[i]}`);
    }
  }

  await browser.close();
  console.log("\n✅ Analysis complete! Check scripts/pardus-analysis/");
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
