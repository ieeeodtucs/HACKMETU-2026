/**
 * Tüm sayfaların full-page screenshot'ını paralel olarak çeker.
 * Dashboard'da agent'lar görünene kadar bekler, ardından agent detay sayfasını da çeker.
 *
 * Kullanım: npx tsx scripts/screenshot-all.ts
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const EMAIL = "admin@admin.com";
const PASSWORD = "admin123";
const OUTPUT_DIR = path.resolve(__dirname, "..", "screenshots");
const AGENT_WAIT_TIMEOUT = 120_000; // 2 dakika agent bekleme

// ── Sayfa tanımları ──────────────────────────────────────────────
interface PageDef {
  name: string;
  folder: string;
  path: string;
  needsAuth: boolean;
  delay?: number;
}

const GUEST_PAGES: PageDef[] = [
  { name: "landing",  folder: "guest", path: "/",         needsAuth: false, delay: 1000 },
  { name: "login",    folder: "guest", path: "/login",    needsAuth: false, delay: 500 },
  { name: "register", folder: "guest", path: "/register", needsAuth: false, delay: 500 },
];

const AUTH_PAGES: PageDef[] = [
  { name: "settings", folder: "settings", path: "/settings", needsAuth: true, delay: 1000 },
  { name: "admin",    folder: "admin",    path: "/admin",    needsAuth: true, delay: 1000 },
];

// ── Yardımcı ─────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  console.log("  ✓ Giriş başarılı");
}

async function takeScreenshot(
  context: BrowserContext,
  pageDef: PageDef
): Promise<string> {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}${pageDef.path}`, { waitUntil: "networkidle", timeout: 30000 });
    if (pageDef.delay) await page.waitForTimeout(pageDef.delay);

    const folder = path.join(OUTPUT_DIR, pageDef.folder);
    ensureDir(folder);
    const filePath = path.join(folder, `${pageDef.name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`  📸 ${pageDef.folder}/${pageDef.name}.png`);
    return filePath;
  } finally {
    await page.close();
  }
}

async function waitForAgents(page: Page): Promise<string[]> {
  console.log("\n⏳ Dashboard'da agent'lar bekleniyor (max 2 dk)...");
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });

  const startTime = Date.now();
  let dots = 0;

  while (Date.now() - startTime < AGENT_WAIT_TIMEOUT) {
    // dash-agent-card kartlarından agent id'lerini çek (footer'daki .dash-agent-id span'ından)
    const agentIds = await page.evaluate(() => {
      const cards = document.querySelectorAll(".dash-agent-card");
      return Array.from(cards).map((card) => {
        const idSpan = card.querySelector(".dash-agent-id");
        return idSpan?.textContent?.trim() || "";
      }).filter(Boolean);
    });

    if (agentIds.length > 0) {
      console.log(`  ✓ ${agentIds.length} agent bulundu: ${agentIds.join(", ")}`);
      return agentIds;
    }

    dots++;
    if (dots % 5 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`  ... ${elapsed}s geçti, hala bekleniyor...`);
    }

    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: "networkidle" });
  }

  console.log("  ⚠ Zaman aşımı — agent bulunamadı, dashboard boş haliyle çekilecek.");
  return [];
}

// ── Ana fonksiyon ────────────────────────────────────────────────

async function main() {
  console.log("🚀 Screenshot scripti başlatılıyor...");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Çıktı: ${OUTPUT_DIR}\n`);

  if (fs.existsSync(OUTPUT_DIR)) fs.rmSync(OUTPUT_DIR, { recursive: true });
  ensureDir(OUTPUT_DIR);

  const browser: Browser = await chromium.launch({ headless: true });

  try {
    // ── 1. Guest sayfaları (paralel) ───────────────────────────
    console.log("📂 Guest sayfaları çekiliyor...");
    const guestCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });
    await Promise.all(GUEST_PAGES.map((p) => takeScreenshot(guestCtx, p)));
    await guestCtx.close();

    // ── 2. Login + agent bekleme ───────────────────────────────
    console.log("\n📂 Auth sayfaları çekiliyor (giriş yapılıyor)...");
    const authCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });

    const loginPage = await authCtx.newPage();
    await login(loginPage);

    await loginPage.close();

    // ── 3. Auth sayfaları + dashboard (paralel, agent beklemeden) ──
    const allAuth: PageDef[] = [
      ...AUTH_PAGES,
      { name: "dashboard-home", folder: "dashboard", path: "/dashboard", needsAuth: true, delay: 2000 },
    ];
    await Promise.all(allAuth.map((p) => takeScreenshot(authCtx, p)));

    await authCtx.close();

    // ── Özet ───────────────────────────────────────────────────
    console.log("\n✅ Tamamlandı! Screenshot'lar:");
    printTree(OUTPUT_DIR, "");
  } finally {
    await browser.close();
  }
}

function printTree(dir: string, prefix: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry, i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? "    " : "│   ";

    if (entry.isDirectory()) {
      console.log(`${prefix}${connector}📁 ${entry.name}/`);
      printTree(path.join(dir, entry.name), prefix + childPrefix);
    } else {
      const size = fs.statSync(path.join(dir, entry.name)).size;
      const kb = (size / 1024).toFixed(0);
      console.log(`${prefix}${connector}🖼️  ${entry.name} (${kb} KB)`);
    }
  });
}

main().catch((err) => {
  console.error("❌ Hata:", err);
  process.exit(1);
});
