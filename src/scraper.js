import { Cluster } from 'puppeteer-cluster';
import puppeteer from 'puppeteer';
import { addExtra } from 'puppeteer-extra';
import Stealth from 'puppeteer-extra-plugin-stealth';
import { cfg } from './config.js';
import { scrapeDuration, scrapeSuccess, scrapeFailure, activeJobs } from './metrics.js';
import pino from 'pino';

const log = pino();
const chromium = addExtra(puppeteer);
chromium.use(Stealth());                         // anti‑bot patches citeturn0search1

// Track last access time for each domain to implement rate limiting
const domainLastAccess = new Map();

// Helper to extract domain from URL
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url; // Return original URL if parsing fails
  }
}

// Rate limiting function to ensure minimum delay between requests to the same domain
async function respectRateLimit(url) {
  const domain = extractDomain(url);
  const now = Date.now();
  const lastAccess = domainLastAccess.get(domain) || 0;
  const timeSinceLastAccess = now - lastAccess;
  
  if (timeSinceLastAccess < cfg.scraper.domainCooldown) {
    const delayNeeded = cfg.scraper.domainCooldown - timeSinceLastAccess;
    log.debug({ domain, delayMs: delayNeeded }, 'Rate limiting applied');
    await new Promise(resolve => setTimeout(resolve, delayNeeded));
  }
  
  domainLastAccess.set(domain, Date.now());
}

export async function createCluster() {
  return Cluster.launch({
    puppeteer: chromium,
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: cfg.cluster.maxConcurrency,
    timeout: cfg.cluster.timeoutMs,
    monitor: false,
    puppeteerOptions: {
      headless: 'new',
      args: [
        '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--ssl-version-min=tls1.3', '--ssl-version-max=tls1.3'
      ]
    }
  });
}

export async function scrapeJob(page, url) {
  const stop = scrapeDuration.startTimer();
  activeJobs.inc();
  try {
    // Apply rate limiting before making the request
    await respectRateLimit(url);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForNetworkIdle({ idleTime: 750, timeout: 30_000 });

    // Auto‑scroll to trigger lazy loaders
    await page.evaluate(async () => {
      let prev = 0;
      while (true) {
        const h = document.body.scrollHeight;
        if (h === prev) break;
        prev = h;
        window.scrollTo(0, h);
        await new Promise(r => setTimeout(r, 600));
      }
    });

    // Stabilise DOM
    let stable = 0, htmlSize = 0;
    while (stable < 1000) {
      const len = (await page.content()).length;
      if (len === htmlSize) stable += 250;
      else { htmlSize = len; stable = 0; }
      await page.waitForTimeout(250);
    }

    const html = await page.content();
    scrapeSuccess.inc();
    return { code: 200, body: html };
  } catch (err) {
    scrapeFailure.inc();
    
    // More detailed error categorization
    let errorCode = 500;
    let errorMsg = err.message;
    
    if (err.name === 'TimeoutError') {
      errorCode = 408; // Request Timeout
      errorMsg = `Request timed out: ${err.message}`;
    } else if (err.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      errorCode = 404; // Not Found
      errorMsg = `Domain not found: ${url}`;
    } else if (err.message.includes('net::ERR_CONNECTION_REFUSED')) {
      errorCode = 503; // Service Unavailable
      errorMsg = `Connection refused: ${url}`;
    } else if (err.message.includes('Navigation timeout')) {
      errorCode = 408; // Request Timeout
      errorMsg = `Navigation timeout: ${url}`;
    }
    
    log.error({ err, url, errorCode }, 'scrape error');
    return { code: errorCode, error: errorMsg };
  } finally {
    stop(); activeJobs.dec();
  }
} 