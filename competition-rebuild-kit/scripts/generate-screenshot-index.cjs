const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'screenshots', 'evidence', 'screenshot-index.json'), 'utf8'));

const attention = {
  'role-gate': 'Check the mode badge and the three role-card hover/focus affordances.',
  'customer-home': 'Check balance hierarchy, count-up numerals, quick-service grid and bottom-nav/sidebar transition.',
  'customer-rift-empty': 'Check amber allocation hero, disabled spend button, lock chips and certificate empty state.',
  'customer-rift-locked': 'Check OAC card fields, remaining balance, sequence counter and progress ring.',
  'spend-modal-form': 'Check demo invoice vs scan segmented control, amount chips and secure-context notice.',
  'authorisation-qr': 'Check large black-on-white QR, raw token text, tx id and amber waiting notice.',
  'merchant-till': 'Check keypad alignment, typed amount input, takings tiles and receipt filter.',
  'invoice-qr': 'Check QR size, raw invoice token, scanner/paste fallback and demo-token shortcut.',
  'merchant-receipts': 'Check empty state and All/Pending/Settled filters.',
  'merchant-sync-relay': 'Check empty-export explanation, batch QR navigation and relay controls.',
  'gateway-queue': 'Check stat tiles, ingest card, per-row SIG/status pills, settlement ledger and node monitor.',
  'light-theme': 'Compare against dark theme; only tokens should change, not layout.',
  'client-onboarding': 'Check role selection, PIN fields and API-not-configured notice.',
  'client-set-pin': 'Check one-time PIN setup after seeded identity.',
  'client-login': 'Check masked phone/role and local PIN login framing.',
};

const lines = [
  '# Screenshot Index',
  '',
  'Automatically generated from `screenshots/evidence/screenshot-index.json`.',
  `Generated: ${data.generatedAt}`,
  '',
  `Total screenshots: ${data.index.length}. Console errors during capture: ${data.consoleErrors.length}.`,
  '',
  '| File | Page / state | Viewport | Visible | What to pay attention to |',
  '| --- | --- | --- | --- | --- |',
];

for (const item of data.index) {
  const file = item.file.replace(/^screenshots\//, '');
  lines.push(`| \`${file}\` | ${item.state} | ${item.viewport} | ${item.detail} | ${attention[item.state] || 'Check layout, spacing, colour and component state against the source files.'} |`);
}

lines.push('', '## Evidence files', '', '- `screenshots/evidence/screenshot-index.json` — machine-readable capture manifest.', '- `screenshots/evidence/console-errors.txt` — browser console output during capture.', '- `screenshots/evidence/*.txt` — accessibility snapshots for key screens.', '');
lines.push('## Capture notes', '', ...data.notes.map((n) => `- ${n}`), '');

fs.writeFileSync(path.join(ROOT, 'design', 'SCREENSHOT_INDEX.md'), lines.join('\n'), 'utf8');
console.log(`Wrote ${lines.length} lines to design/SCREENSHOT_INDEX.md`);
