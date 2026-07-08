import { chromium, Browser } from "playwright";

// Headless Chromium singleton — launched on first capture, reused afterwards.
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch((err) => {
      browserPromise = null; // allow retry after a failed launch
      throw err;
    });
  }
  return browserPromise;
}

const DEFAULT_VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 1000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const SETTLE_TIMEOUT_MS = 3_000;

export async function captureWebsite(url: string, viewportWidth?: number): Promise<string> {
  const parsed = new URL(url); // throws on invalid URL
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL scheme: ${parsed.protocol}`);
  }

  const width =
    typeof viewportWidth === "number" && viewportWidth >= 320 && viewportWidth <= 3840
      ? Math.round(viewportWidth)
      : DEFAULT_VIEWPORT_WIDTH;

  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT } });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });
    // Best-effort settle: give SPAs a moment to finish network activity, but never
    // fail on pages that hold persistent connections (HMR/analytics WebSockets).
    await page.waitForLoadState("networkidle", { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});
    // Scroll through the page so lazy-loaded sections render before the full-page shot,
    // then return to top so sticky headers land in their natural position.
    await page
      .evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 150));
        }
        window.scrollTo(0, 0);
      })
      .catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});
    const buffer = await page.screenshot({ type: "png", fullPage: true });
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } finally {
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    browserPromise = null;
    if (browser) await browser.close();
  }
}
