import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const contentTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript' };

const finish = (exitCode, verdict) => {
  console.log(`verdict: ${verdict}`);
  process.exit(exitCode);
};

const run = (command) => execSync(`${command} 2>&1`, { cwd: folder, encoding: 'utf8' }).trim();

const readInstalledVersion = async (name) =>
  JSON.parse(await readFile(path.join(folder, 'node_modules', name, 'package.json'), 'utf8'));

const reproduce = async () => {
  const installOutput = run('npm install --no-audit --no-fund');
  console.log(`npm install peer-dependency warnings: ${installOutput.split('\n').filter((line) => /peer|ERESOLVE/iu.test(line)).join(' | ') || 'none'}`);
  run('npx playwright install chromium');
  const { build } = await import('esbuild');
  await build({ entryPoints: [path.join(folder, 'main.js')], bundle: true, format: 'esm', outfile: path.join(folder, 'bundle.js'), logLevel: 'error' });
  const { chromium } = await import('playwright');

  const calendar = await readInstalledVersion('@schedule-x/calendar');
  const dragAndDrop = await readInstalledVersion('@schedule-x/drag-and-drop');
  console.log(`node ${process.version} ${process.platform}-${process.arch}, @schedule-x/calendar ${calendar.version}, @schedule-x/drag-and-drop ${dragAndDrop.version}`);
  console.log(
    `@schedule-x/drag-and-drop: npm latest = ${run('npm view @schedule-x/drag-and-drop dist-tags.latest')}, ` +
      `peerDependencies = ${JSON.stringify(dragAndDrop.peerDependencies ?? 'none')}, ` +
      `deprecated = ${run('npm view @schedule-x/drag-and-drop@3.7.3 deprecated') || 'no'}`,
  );

  const server = createServer(async (request, response) => {
    const filePath = path.join(folder, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    const body = await readFile(filePath.endsWith(path.sep) ? path.join(filePath, 'index.html') : filePath).catch(() => undefined);
    response.writeHead(body === undefined ? 404 : 200, { 'content-type': contentTypes[path.extname(filePath)] ?? 'text/html' });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    console.log(`chromium ${browser.version()}`);
    const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await tab.goto(`http://127.0.0.1:${server.address().port}/`);
    const event = tab.locator('.sx__time-grid-event').first();
    await event.waitFor({ timeout: 15_000 });
    await event.scrollIntoViewIfNeeded();
    const box = await event.boundingBox();
    console.log(`week view rendered "${(await event.innerText()).replace(/\s+/gu, ' ')}" at ${Math.round(box.x)},${Math.round(box.y)}`);

    await tab.mouse.move(box.x + box.width / 2, box.y + 10);
    await tab.mouse.down();
    await tab.mouse.move(box.x + box.width / 2, box.y + 70, { steps: 12 });
    await tab.mouse.up();
    console.log('dragged the event 60 px down with the mouse');

    await tab.waitForFunction(() => window.outcome !== undefined, undefined, { timeout: 10_000 }).catch(() => undefined);
    return await tab.evaluate(() => window.outcome);
  } finally {
    await browser.close();
    server.close();
  }
};

let outcome;
try {
  outcome = await reproduce();
} catch (error) {
  finish(2, `a step before the check failed: ${error.message.split('\n')[0]}`);
}
console.log(`after the drag: ${outcome === undefined ? 'no error and no onEventUpdate within 10 s' : `${outcome.kind}: ${outcome.detail}`}`);
if (outcome?.kind === 'threw' && /startTimeGridDrag is not a function/u.test(outcome.detail)) {
  finish(1, 'the drag throws: drag-and-drop 3.7.3 has no startTimeGridDrag, which calendar 4.9.1 calls');
}
if (outcome?.kind === 'updated') {
  finish(0, 'the drag moved the event');
}
finish(2, 'neither the startTimeGridDrag error nor an event update');
