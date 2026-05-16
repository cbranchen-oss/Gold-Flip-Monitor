import * as cheerio from 'cheerio';
import { spawn, execSync } from 'child_process';
import puppeteerCore from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLLECTPURE_URL = 'https://www.collectpure.com/marketplace/product/1-oz-pamp-fortuna-gold-bar-9999-fine-in-assay000023';
const COSTCO_PRODUCT_URL = 'https://www.costco.com/1-oz-gold-bar-pamp-suisse-lady-fortuna-veriscan-new-in-assay.product.4000363990.html';
const CHROME_DEBUG_PORT = 9333;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

const isProduction = !!(process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production');

let cachedBid = null;
let cacheTime = null;

// Fallback parsing if main parsing fails
function extractBidFromScript(html) {
  try {
    const scriptMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/s);
    if (scriptMatch) {
      const jsonData = JSON.parse(scriptMatch[1]);
      const props = jsonData.props?.pageProps?.initialState?.product;
      if (props?.highestBid) {
        return parseFloat(props.highestBid);
      }
    }

    const bidMatch = html.match(/highest\s*bid[:\s]*\$?[\s]*([0-9,]+\.?\d*)/i);
    if (bidMatch) {
      return parseFloat(bidMatch[1].replace(/,/g, ''));
    }
  } catch (e) {
    console.error('Error parsing script tags:', e.message);
  }
  return null;
}

export async function getCollectPureBid() {
  if (cachedBid !== null && cacheTime && Date.now() - cacheTime < CACHE_DURATION) {
    console.log('Returning cached bid:', cachedBid);
    return {
      bid: cachedBid,
      timestamp: new Date().toISOString(),
      cached: true
    };
  }

  try {
    console.log('Fetching CollectPure bid from:', COLLECTPURE_URL);
    const response = await fetch(COLLECTPURE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`CollectPure returned status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let bid = null;

    const text = $.text();
    const bidMatch = text.match(/Highest\s*Bid\s*\$?[\s]*([0-9,]+\.?\d*)/i);
    if (bidMatch) {
      bid = parseFloat(bidMatch[1].replace(/,/g, ''));
      console.log('Found bid from text:', bid);
    }

    if (!bid) {
      bid = extractBidFromScript(html);
      if (bid) {
        console.log('Found bid from script:', bid);
      }
    }

    if (!bid) {
      const priceMatches = text.match(/\$?([0-9,]{1,3}(?:,[0-9]{3})*\.[0-9]{2}|\d{3,5}\.\d{2})/g);
      if (priceMatches && priceMatches.length > 0) {
        bid = Math.max(...priceMatches.map(p => parseFloat(p.replace(/[$,]/g, ''))));
        console.log('Found bid from price pattern:', bid);
      }
    }

    if (bid === null || isNaN(bid)) {
      throw new Error('Could not extract bid price from CollectPure page');
    }

    cachedBid = bid;
    cacheTime = Date.now();

    return {
      bid,
      timestamp: new Date().toISOString(),
      cached: false
    };
  } catch (error) {
    console.error('Error fetching CollectPure bid:', error.message);
    throw error;
  }
}

export function clearCache() {
  cachedBid = null;
  cacheTime = null;
}

// --- Costco scraper: dual-mode Chrome ---

// LOCAL: Spawn system Chrome directly to bypass Akamai bot detection.
// Puppeteer's launch() adds automation markers that Akamai detects.
// Spawning Chrome as a regular process + connecting via DevTools protocol bypasses this.
async function getCostcoPriceLocal() {
  const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const CHROME_PROFILE_DIR = path.join(__dirname, 'data', 'chrome-profile-clean');

  let chromeProc;
  let browser;

  try {
    console.log('[local] Launching system Chrome...');
    chromeProc = await new Promise((resolve, reject) => {
      const proc = spawn(CHROME_PATH, [
        `--user-data-dir=${CHROME_PROFILE_DIR}`,
        `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1366,768',
      ], { stdio: 'ignore', detached: true });
      proc.on('error', reject);
      setTimeout(() => resolve(proc), 3000);
    });

    browser = await puppeteerCore.connect({
      browserURL: `http://127.0.0.1:${CHROME_DEBUG_PORT}`
    });

    const page = await createFreshPage(browser);
    const price = await scrapeProductPrice(page);

    browser.disconnect();
    return price;
  } catch (error) {
    if (browser) browser.disconnect();
    throw error;
  } finally {
    if (chromeProc) {
      try { process.kill(-chromeProc.pid); } catch {}
    }
    try {
      execSync(`pkill -f "remote-debugging-port=${CHROME_DEBUG_PORT}"`, { stdio: 'ignore' });
    } catch {}
  }
}

// PRODUCTION (Railway): Use bundled Chromium via puppeteer.launch().
// Akamai may block this, but it's the only option without system Chrome.
// The persistent profile helps accumulate valid session cookies over retries.
async function getCostcoPriceProduction() {
  let browser;

  try {
    console.log('[production] Launching bundled Chromium...');
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--window-size=1366,768',
      ]
    });

    const page = await createFreshPage(browser);
    const price = await scrapeProductPrice(page);

    await browser.close();
    return price;
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    throw error;
  }
}

// Shared: create a clean page, close any existing tabs
async function createFreshPage(browser) {
  const existingPages = await browser.pages();
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  for (const p of existingPages) {
    try { await p.close(); } catch {}
  }
  return page;
}

// Shared: homepage -> login -> product page -> extract price
async function scrapeProductPrice(page) {
  // Step 1: Visit homepage to establish Akamai session
  console.log('Visiting Costco homepage...');
  await page.goto('https://www.costco.com/', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });
  await new Promise(r => setTimeout(r, 8000));

  // Step 2: Log in
  const settings = store.getSettings();
  if (settings.costcoEmail && settings.costcoPassword) {
    console.log('Logging in to Costco...');
    await page.goto('https://www.costco.com/LogonForm', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(r => setTimeout(r, 3000));

    const needsLogin = await page.evaluate(() => {
      return !!document.querySelector('#signInName');
    });

    if (needsLogin) {
      await page.waitForSelector('#signInName', { timeout: 10000 });
      await page.click('#signInName', { clickCount: 3 });
      await page.type('#signInName', settings.costcoEmail, { delay: 40 });
      await new Promise(r => setTimeout(r, 500));

      await page.click('#password', { clickCount: 3 });
      await page.type('#password', settings.costcoPassword, { delay: 40 });
      await new Promise(r => setTimeout(r, 500));

      const submitBtn = await page.$('#next') || await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
      console.log('Login complete');
    } else {
      console.log('Already logged in (persistent session)');
    }
  }

  // Step 3: Navigate to product page
  console.log('Navigating to product page...');
  await page.goto(COSTCO_PRODUCT_URL, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  await new Promise(r => setTimeout(r, 5000));

  // Check for Akamai block
  const pageTitle = await page.title();
  if (pageTitle.toLowerCase().includes('access denied')) {
    throw new Error('Akamai blocked access to the product page');
  }

  // Step 4: Extract price
  // Costco renders price as: <span automation-id="productPriceOutput">4,769.99</span><span class="currency">$</span>
  // The dollar sign is separate, so we extract just the numeric value from the price element.
  const priceText = await page.evaluate(() => {
    const el = document.querySelector('[automation-id="productPriceOutput"]');
    if (el) {
      const m = el.textContent.trim().match(/([\d,]+\.\d{2})/);
      if (m) return m[1];
    }
    return null;
  });

  if (!priceText) {
    const pageTitle = await page.title();
    const snippet = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.error('Page snippet:', snippet);
    throw new Error(`Could not extract price (page: "${pageTitle}")`);
  }

  const price = parseFloat(priceText.replace(/[,$]/g, ''));
  if (isNaN(price) || price < 1000 || price > 20000) {
    throw new Error(`Price out of expected range ($1,000-$20,000): "${priceText}" → ${price}`);
  }

  console.log('Found Costco price:', price);
  return {
    price,
    timestamp: new Date().toISOString()
  };
}

export async function getCostcoPrice() {
  console.log(`Environment: ${isProduction ? 'production' : 'local'}`);
  if (isProduction) {
    return getCostcoPriceProduction();
  } else {
    return getCostcoPriceLocal();
  }
}
