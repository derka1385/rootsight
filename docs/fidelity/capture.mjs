/** No project dependency: point PLAYWRIGHT_MODULE at an existing Playwright install. */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.FIDELITY_URL || 'http://localhost:5174';
const output = path.resolve(process.env.FIDELITY_OUTPUT || 'docs/fidelity');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.CHROME_CHANNEL || 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
const report = [];
try {
  for (const name of (process.env.FIDELITY_PROFILES || 'monstera,basil,cactus,photo-monstera,photo-basil,photo-cactus').split(',')) {
    for (const [suffix, query] of [['today', ''], ['grown', '&month=24'], ['wilt', '&water=60'], ['cutaway', '&cutaway']]) {
      await page.goto(`${base}/src/three/fidelity.html?capture&profile=${name}${query}`);
      await page.locator('canvas[data-ready="true"]').waitFor();
      await page.waitForTimeout(1400);
      await page.screenshot({ path: path.join(output, `${name}-${suffix}.png`) });
      report.push({ name, state: suffix, ...JSON.parse(await page.locator('canvas').getAttribute('data-metrics')) });
    }
  }
  await writeFile(path.join(output, 'metrics.json'), JSON.stringify({ viewport: [390, 844], dpr: 1, errors, renders: report }, null, 2) + '\n');
  if (errors.length) throw new Error(errors.join('\n'));
  if (report.some(r => r.peakCalls >= 400)) throw new Error('Draw-call budget exceeded');
} finally { await browser.close(); }
console.log(`Saved ${report.length} renders and metrics in ${output}`);
