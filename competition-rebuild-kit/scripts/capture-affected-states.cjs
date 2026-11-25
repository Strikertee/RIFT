const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'screenshots');
const BANK_URL = process.env.BANK_URL || 'http://127.0.0.1:5174';
const VIEWPORTS = [
  ['mobile-390x844', 390, 844],
  ['desktop-1440x900', 1440, 900],
];

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined,
  });
  const notes = [];
  try {
    for (const [key, width, height] of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' });
      const page = await context.newPage();
      await page.route('**/api/v1/health', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'degraded',
            environment: 'screenshot-capture',
            version: '1.0.0',
            timestamp: '2026-01-01T00:00:00Z',
            database: 'unavailable',
            issuer_key_loaded: false,
            issuer_pubkey_hex: '',
          }),
        })
      );
      await page.goto(BANK_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: /Customer Bank/i }).click();
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: 'Open RIFT' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: '₦10,000' }).click();
      await page.getByRole('button', { name: 'Lock funds' }).click();
      await page.waitForTimeout(800);
      await page.getByRole('button', { name: 'Spend offline via QR' }).click();
      await page.waitForTimeout(400);
      await page.getByRole('button', { name: '₦2,000' }).click();
      await page.getByRole('button', { name: 'Sign payment token' }).click();
      await page.waitForTimeout(700);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
      if (await page.getByRole('dialog').count()) {
        notes.push(`${key}: dialog still open after Escape`);
      }

      await page.getByRole('button', { name: 'Switch terminal role' }).click();
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: /Merchant Raise invoices/i }).click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT, 'other-pages', `merchant-till-${key}-${width}x${height}.png`) });

      for (const d of ['2', '0', '0', '0']) {
        await page.getByRole('button', { name: d, exact: true }).click();
        await page.waitForTimeout(120);
      }
      await page.getByRole('button', { name: 'Create invoice QR' }).click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, 'interaction-states', `merchant-invoice-qr-${key}-${width}x${height}.png`) });

      await page.getByRole('button', { name: 'Receipts', exact: true }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, 'other-pages', `merchant-receipts-${key}-${width}x${height}.png`) });

      await page.getByRole('button', { name: 'Sync & relay', exact: true }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, 'other-pages', `merchant-sync-${key}-${width}x${height}.png`) });

      await page.getByRole('button', { name: 'Switch terminal role' }).click();
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: /Gateway Collect receipt/i }).click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT, 'other-pages', `gateway-${key}-${width}x${height}.png`) });

      const light = page.getByRole('button', { name: 'Switch to light mode' });
      if (await light.count()) {
        await light.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(OUT, 'interaction-states', `gateway-light-${key}-${width}x${height}.png`) });
      }
      notes.push(`${key}: recaptured merchant/gateway states`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.appendFileSync(path.join(OUT, 'evidence', 'console-errors.txt'), `\nRecapture notes:\n${notes.join('\n')}\n`, 'utf8');
  console.log(notes.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
