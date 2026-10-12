// Local fixture only; requires a running Next development server and Playwright.
// DESK_QA_URL=http://localhost:3001/dev/desk node scripts/qa/dashboard-desk.playwright.mjs
// PLAYWRIGHT_MODULE can point to an existing external Playwright installation.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DESK_QA_URL || 'http://localhost:3001/dev/desk';
const output = path.resolve(process.env.DESK_QA_OUTPUT || 'tmp/desk-qa');
const report = { url, environment: 'Next development, headless Chrome, local fixture; rAF cadence is not GPU timing', checks: [], arrivals: [], errors: [] };
const verify = (ok, name) => { if (!ok) throw Error(name); report.checks.push(name); console.log('PASS', name); };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  if (!localStorage.getItem('kenangin-theme')) localStorage.setItem('kenangin-theme', 'dark');
  window.addEventListener('kenangin:desk-context', e => { window.__desk = e.detail; });
  window.__arrival = { states: [], frames: [] };
  let previous, sampling = false, last = 0;
  const sample = now => {
    if (document.documentElement.dataset.deskEntry !== 'running') { sampling = false; return; }
    if (last) window.__arrival.frames.push(now - last);
    last = now; requestAnimationFrame(sample);
  };
  new MutationObserver(() => {
    const state = document.documentElement?.dataset.deskEntry || 'idle';
    if (state === previous) return;
    previous = state;
    window.__arrival.states.push({ state, at: performance.now() });
    if (state === 'running' && !sampling) { sampling = true; last = 0; requestAnimationFrame(sample); }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-desk-entry'] });
});
const page = await context.newPage();
page.on('pageerror', e => report.errors.push(e.message));
const sceneReady = () => page.locator('.dashboard-desk[data-ready="true"]').waitFor();
const inspect = () => page.evaluate(() => { window.dispatchEvent(new Event('kenangin:inspect-desk')); return { ...window.__desk.renderer.info.render }; });
const visible = () => page.evaluate(() => { const body = document.querySelector('.app-shell__body'); return Boolean(body) && !document.documentElement.dataset.deskEntry && getComputedStyle(body).opacity === '1'; });
const seed = () => page.evaluate(() => sessionStorage.setItem('kenangin:desk-entry', JSON.stringify({ version: 2, at: Date.now(), destination: '/dashboard' })));
const arrive = async () => {
  await seed(); await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.deskEntry === 'running');
};
const idle = () => page.waitForFunction(() => !document.documentElement.dataset.deskEntry);
const frozen = async label => {
  await page.waitForTimeout(250); const before = await inspect();
  await page.waitForTimeout(650); const after = await inspect();
  verify(before.frame === after.frame, label);
  return after;
};
try {
  await page.goto(url); await sceneReady();
  verify(await visible(), 'ordinary dashboard visit has no entry gate');
  report.renderer = await frozen('idle scene submits zero additional frames');
  report.gpu = await page.evaluate(() => {
    const gl = window.__desk.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable';
  });
  for (let run = 0; run < 3; run++) {
    await arrive(); await idle();
    const timing = await page.evaluate(() => {
      const { states, frames } = window.__arrival, sorted = [...frames].sort((a,b) => a-b);
      const start = states.find(x => x.state === 'running'), end = states.find(x => x.state === 'idle' && x.at > start.at);
      return { states, duration: end.at-start.at, samples: frames.length, p50: sorted[Math.floor(sorted.length*.5)], p95: sorted[Math.floor(sorted.length*.95)], max: sorted.at(-1), over33ms: frames.filter(x=>x>33.4).length };
    });
    report.arrivals.push(timing);
    verify(timing.duration < 1900 && timing.duration > 1400, `arrival ${run+1} settles within 1.4–1.9 seconds`);
    await frozen(`arrival ${run+1} returns to demand rendering`);
  }
  await page.reload(); await sceneReady();
  verify(!(await page.evaluate(() => window.__arrival.states.some(x => x.state === 'running'))), 'refresh does not replay consumed arrival');
  await arrive(); await page.keyboard.press('Tab'); await idle();
  verify(await visible(), 'first keyboard input reveals dashboard immediately');
  await frozen('keyboard skip stops the camera timeline');
  await arrive(); await page.mouse.click(20, 450); await idle();
  verify(await visible(), 'first pointer input skips arrival');
  await arrive();
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await idle(); verify(await visible(), 'hidden document releases the entry gate');
  await frozen('hidden document cancels the timeline');
  await page.reload(); await sceneReady();
  await page.locator('.dashboard-search input').fill('Cerita');
  verify(await page.locator('.dashboard-room-card').count() === 1, 'search filters real room components');
  await frozen('search input does not restart background rendering');
  await page.locator('.dashboard-search input').fill('');
  await page.locator('.dashboard-room-card__more').first().click();
  verify(await page.locator('.dashboard-room-card').first().evaluate(el => getComputedStyle(el).overflow === 'visible'), 'room action menu escapes card clipping');
  await page.locator('.dashboard-room-card__more').first().click();
  await page.getByRole('button', { name: 'Buat Room Baru', exact: false }).click();
  await page.getByRole('dialog').waitFor();
  verify(await page.getByRole('heading', { name: 'Mulai kenangan baru' }).isVisible(), 'create room dialog remains usable');
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.evaluate(() => scrollTo(0, 0));
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(output, 'dark-desktop.png') });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(150);
    verify(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `dark layout fits ${width}px`);
    if (width === 390) await page.screenshot({ path: path.join(output, 'dark-mobile.png'), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Aktifkan tema terang' }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light' && !document.documentElement.dataset.themeTransitioning);
  verify(await page.evaluate(() => window.__desk.scene.getObjectByName('Desk / grain').material.uniforms.uDark.value === 0), 'theme toggle updates DOM and scene together');
  await frozen('light theme is also idle');
  await page.screenshot({ path: path.join(output, 'light-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250);
  verify(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'light layout fits mobile');
  await page.screenshot({ path: path.join(output, 'light-mobile.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await seed(); await page.reload();
  await page.waitForTimeout(500);
  verify(await page.locator('canvas').count() === 0 && await visible(), 'reduced motion uses static desk without WebGL or hidden content');
  await page.screenshot({ path: path.join(output, 'reduced-motion.png') });
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await sceneReady();
  await arrive(); await page.emulateMedia({ reducedMotion: 'reduce' }); await idle();
  verify(await page.locator('canvas').count() === 0 && await visible(), 'changing motion preference during arrival cancels cleanly');
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await sceneReady();
  await page.evaluate(() => { window.dispatchEvent(new Event('kenangin:inspect-desk')); window.__desk.renderer.forceContextLoss(); });
  await page.locator('.dashboard-desk[data-renderer="static"]').waitFor();
  verify(await visible() && await page.locator('canvas').count() === 0, 'lost WebGL context restores static desk and usable content');
  await seed();
  // Delay the renderer payload, not Turbopack's tiny bootstrap/async-loader stub.
  // The latter is part of Next's application entry, before React can mount any boundary.
  const rendererChunks = /node_modules_three_build.*\.js(?:\?.*)?$/;
  await page.route(rendererChunks, async route => { await new Promise(resolve => setTimeout(resolve, 3000)); await route.continue(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.app-shell__body').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.deskEntry);
  verify(await visible() && await page.locator('canvas').count() === 0, 'slow renderer loading releases content before the scene is ready');
  await sceneReady();
  verify(!(await page.evaluate(() => window.__arrival.states.some(x => x.state === 'running'))), 'late scene never hides content to replay arrival');
  await page.unroute(rendererChunks);
  const noGpu = await context.newPage();
  await noGpu.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...rest) { return /webgl/.test(type) ? null : original.call(this, type, ...rest); };
    sessionStorage.setItem('kenangin:desk-entry', JSON.stringify({ version: 2, at: Date.now(), destination: '/dashboard' }));
  });
  await noGpu.goto(url); await noGpu.locator('.dashboard-desk[data-renderer="static"]').waitFor();
  await noGpu.waitForFunction(() => !document.documentElement.dataset.deskEntry);
  verify(await noGpu.locator('canvas').count() === 0, 'WebGL unavailable recovers through the error boundary');
  await noGpu.close();
  verify(report.errors.length === 0, 'no uncaught application errors during normal and interrupted flows');
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ checks: report.checks.length, arrivals: report.arrivals, renderer: report.renderer, gpu: report.gpu, output }, null, 2));
