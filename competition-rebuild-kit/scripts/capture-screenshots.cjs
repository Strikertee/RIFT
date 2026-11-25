const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'screenshots');
const EVIDENCE = path.join(ROOT, 'screenshots', 'evidence');
fs.mkdirSync(EVIDENCE, { recursive: true });

const BANK_URL = process.env.BANK_URL || 'http://127.0.0.1:5174';
const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:5173';

const VIEWPORTS = [
  ['mobile-360x800', 360, 800],
  ['mobile-375x812', 375, 812],
  ['mobile-390x844', 390, 844],
  ['mobile-412x915', 412, 915],
  ['tablet-768x1024', 768, 1024],
  ['tablet-landscape-1024x768', 1024, 768],
  ['laptop-1280x800', 1280, 800],
  ['desktop-1440x900', 1440, 900],
  ['desktop-1920x1080', 1920, 1080],
];

const index = [];
const consoleErrors = [];
const notes = [];
let browser;

function record(file, page, viewport, state, detail) {
  index.push({
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    url: page.url(),
    viewport: `${viewport.width}x${viewport.height}`,
    state,
    detail,
  });
}

async function shot(page, folder, name, viewport, state, detail, fullPage = false) {
  const dir = path.join(OUT, folder);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: file, fullPage });
  record(file, page, viewport, state, detail);
  return file;
}

async function makePage(viewport, url, { blockApi = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ url: page.url(), message: msg.text() });
  });
  if (blockApi) {
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
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  return { context, page };
}

async function aria(page, name) {
  try {
    const snap = await page.locator('body').ariaSnapshot();
    fs.writeFileSync(path.join(EVIDENCE, `${name}.txt`), snap, 'utf8');
  } catch (error) {
    notes.push(`ariaSnapshot failed for ${name}: ${error.message}`);
  }
}

async function safeClick(page, locator, label) {
  try {
    await locator.first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
  } catch (error) {
    notes.push(`Click failed (${label}): ${error.message}`);
  }
}

async function selectBankRole(page, kind) {
  const patterns = {
    customer: /Customer Bank/i,
    merchant: /Merchant Raise invoices/i,
    gateway: /Gateway Collect receipt/i,
  };
  await safeClick(page, page.getByRole('button', { name: patterns[kind] }), `role:${kind}`);
}

async function captureBankViewport(viewport, key) {
  const { context, page } = await makePage(viewport, BANK_URL, { blockApi: true });

  await shot(page, 'other-pages', `rolegate-${key}`, viewport, 'role-gate', 'Three role cards and simulated-core badge');
  if (key === 'desktop-1440x900') await aria(page, 'bank-rolegate-1440');

  await selectBankRole(page, 'customer');
  await page.waitForTimeout(1200);
  await shot(page, 'dashboard', `customer-overview-${key}`, viewport, 'customer-home', 'Overview with balances, quick services, analytics and recent activity');
  if (key === 'mobile-390x844') await aria(page, 'bank-customer-home-390');

  await safeClick(page, page.getByRole('button', { name: 'Open RIFT' }), 'open-rift');
  await shot(page, 'dashboard', `customer-rift-empty-${key}`, viewport, 'customer-rift-empty', 'RIFT lock form before allocation');

  await safeClick(page, page.getByRole('button', { name: '₦10,000' }), 'lock-10000');
  await safeClick(page, page.getByRole('button', { name: 'Lock funds' }), 'lock-funds');
  await page.waitForTimeout(800);
  await shot(page, 'dashboard', `customer-rift-locked-${key}`, viewport, 'customer-rift-locked', 'Allocation certificate with OAC and remaining balance');
  if (key === 'desktop-1440x900') await aria(page, 'bank-customer-rift-locked-1440');

  if (key === 'desktop-1440x900' || key === 'mobile-390x844') {
    await safeClick(page, page.getByRole('button', { name: 'Spend offline via QR' }), 'spend-qr');
    await shot(page, 'interaction-states', `spend-modal-form-${key}`, viewport, 'spend-modal-form', 'Demo invoice form with amount chips');
    await safeClick(page, page.getByRole('button', { name: '₦2,000' }), 'spend-2000');
    await safeClick(page, page.getByRole('button', { name: 'Sign payment token' }), 'sign-token');
    await page.waitForTimeout(800);
    await shot(page, 'interaction-states', `auth-qr-${key}`, viewport, 'authorisation-qr', 'Signed authorisation QR with raw token');
    await aria(page, `bank-auth-qr-${viewport.width}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  }

  await safeClick(page, page.getByRole('button', { name: 'Switch terminal role' }), 'switch-role');
  await selectBankRole(page, 'merchant');
  await page.waitForTimeout(1000);
  await shot(page, 'other-pages', `merchant-till-${key}`, viewport, 'merchant-till', 'Merchant keypad and empty receipt outbox');

  await safeClick(page, page.getByRole('button', { name: '2', exact: true }), 'digit-2');
  await safeClick(page, page.getByRole('button', { name: '0', exact: true }), 'digit-0');
  await safeClick(page, page.getByRole('button', { name: '0', exact: true }), 'digit-0');
  await safeClick(page, page.getByRole('button', { name: '0', exact: true }), 'digit-0');
  await safeClick(page, page.getByRole('button', { name: 'Create invoice QR' }), 'create-invoice');
  await page.waitForTimeout(600);
  await shot(page, 'interaction-states', `merchant-invoice-qr-${key}`, viewport, 'invoice-qr', 'Invoice QR, raw token and paste/camera intake');
  if (key === 'desktop-1440x900') await aria(page, 'bank-merchant-invoice-1440');

  await safeClick(page, page.getByRole('button', { name: 'Receipts', exact: true }), 'merchant-receipts');
  await shot(page, 'other-pages', `merchant-receipts-${key}`, viewport, 'merchant-receipts', 'Receipt outbox filtered view');
  await safeClick(page, page.getByRole('button', { name: 'Sync & relay', exact: true }), 'merchant-sync');
  await shot(page, 'other-pages', `merchant-sync-${key}`, viewport, 'merchant-sync-relay', 'Batch export and relay controls');

  await safeClick(page, page.getByRole('button', { name: 'Switch terminal role' }), 'switch-role');
  await selectBankRole(page, 'gateway');
  await page.waitForTimeout(1000);
  await shot(page, 'other-pages', `gateway-${key}`, viewport, 'gateway-queue', 'Gateway stats, ingest card, relay queue and settlement ledger');

  const themeBtn = page.getByRole('button', { name: 'Switch to light mode' });
  if (await themeBtn.count()) {
    await safeClick(page, themeBtn, 'light-mode');
    if (key === 'desktop-1440x900' || key === 'mobile-390x844') {
      await shot(page, 'interaction-states', `gateway-light-${key}`, viewport, 'light-theme', 'Light theme variant');
    }
  }

  await context.close();
}

async function seedClientIdentity(page, withCredential) {
  await page.evaluate(async (withCredential) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('rift_edge_db', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('keystore')) req.result.createObjectStore('keystore', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const identity = {
      id: 'primary_identity',
      user_id: 'usr_demo_capture',
      role: 'CUSTOMER',
      display_name: 'Capture Demo',
      phone_number: '+2348000000099',
      public_key_hex: '11'.repeat(32),
      private_key_hex: '22'.repeat(32),
      issuer_pubkey_hex: '33'.repeat(32),
      mock_account_number: '0000000000',
      mock_balance_kobo: 5000000,
      reserved_balance_kobo: 0,
      registered_at: new Date().toISOString(),
    };
    if (withCredential) {
      identity.credential_salt = '44'.repeat(16);
      identity.credential_hash = '55'.repeat(32);
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction('keystore', 'readwrite');
      tx.objectStore('keystore').put(identity);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, withCredential);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
}

async function captureClientAuth(viewport, key) {
  const { context, page } = await makePage(viewport, CLIENT_URL, { blockApi: false });
  await shot(page, 'authentication', `client-onboarding-${key}`, viewport, 'client-onboarding', 'Role selection and onboarding form; API-not-configured notice may be visible');
  await seedClientIdentity(page, false);
  await shot(page, 'authentication', `client-set-pin-${key}`, viewport, 'client-set-pin', 'One-time PIN setup after seeded registered identity');
  await seedClientIdentity(page, true);
  await shot(page, 'authentication', `client-login-${key}`, viewport, 'client-login', 'Device-local PIN login screen with masked phone and role');
  await context.close();
}

async function main() {
  const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
  try {
    for (const [key, width, height] of VIEWPORTS) {
      notes.push(`Capturing bank ${key}`);
      await captureBankViewport({ width, height }, key);
    }
    for (const [key, width, height] of [
      ['mobile-390x844', 390, 844],
      ['desktop-1440x900', 1440, 900],
    ]) {
      notes.push(`Capturing client auth ${key}`);
      await captureClientAuth({ width, height }, key);
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(EVIDENCE, 'screenshot-index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), index, consoleErrors, notes }, null, 2), 'utf8');
  fs.writeFileSync(path.join(EVIDENCE, 'console-errors.txt'), consoleErrors.map((e) => `${e.url}\n  ${e.message}`).join('\n') || 'No console errors captured.', 'utf8');
  console.log(`Captured ${index.length} screenshots.`);
  console.log(`Console errors: ${consoleErrors.length}`);
  console.log(notes.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
