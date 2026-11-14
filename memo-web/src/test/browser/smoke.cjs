// Run after Gradle build. Pass an external Playwright package path if it is not on NODE_PATH.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const evidenceDir = path.join(root, '.dev-cycle/browser');
const classpath = [
  'memo-web/build/classes/java/main',
  'memo-web/build/resources/main',
  'memo-core/build/classes/java/main'
].join(path.delimiter);

async function startServer(file, port = 0) {
  const process = spawn('java', ['-cp', classpath, 'tiny.memo.web.MemoApplication', String(port), file], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  let errors = '';
  process.stderr.on('data', data => { errors += data; });
  try {
    const address = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out: ' + errors)), 15000);
      const finish = (callback, value) => { clearTimeout(timeout); callback(value); };
      process.on('error', error => finish(reject, error));
      process.on('exit', code => finish(reject, new Error('Server exited: ' + code + ' ' + errors)));
      process.stdout.on('data', data => {
        output += data;
        const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
        if (match) finish(resolve, { url: match[0], port: Number(match[1]) });
      });
    });
    return { process, ...address };
  } catch (error) {
    if (process.exitCode === null) process.kill();
    throw error;
  }
}

async function stopServer(server) {
  if (server && server.process.exitCode === null && server.process.signalCode === null) {
    const exited = once(server.process, 'exit');
    server.process.kill();
    await exited;
  }
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  for (const name of ['result.json', 'after-restart.png', 'mobile.png']) {
    await fs.rm(path.join(evidenceDir, name), { force: true });
  }
  const { chromium } = require(process.argv[2] || 'playwright');
  const channel = process.argv[3] || 'chrome';
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'tiny-memo-browser-'));
  const file = path.join(temporary, 'memo.txt');
  const checks = [];
  let server;
  let browser;
  try {
    server = await startServer(file);
    const firstPid = server.process.pid;
    browser = await chromium.launch({ channel, headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const memo = page.getByRole('textbox', { name: '메모' });
    const save = page.getByRole('button', { name: '저장', exact: true });
    const loaded = () => page.waitForFunction(() => !document.querySelector('#save').disabled);
    const saveText = async content => {
      await memo.fill(content);
      await save.click();
      await page.getByRole('status').filter({ hasText: /^저장했습니다\.$/ }).waitFor();
      assert.equal(await fs.readFile(file, 'utf8'), content);
    };

    await page.goto(server.url);
    await loaded();
    assert.equal(await memo.count(), 1);
    assert.equal(await page.getByRole('button').count(), 1);
    assert.equal(await memo.inputValue(), '');
    await assert.rejects(fs.access(file), { code: 'ENOENT' });
    checks.push('initial-empty-without-file');

    const content = '  브라우저 한글 메모 📝\n두 번째 줄\n\n마지막 줄  \n';
    await saveText(content);
    assert.deepEqual(await fs.readFile(file), Buffer.from(content, 'utf8'));
    checks.push('save-utf8-korean-and-newlines');
    await page.reload();
    await loaded();
    assert.equal(await memo.inputValue(), content);
    checks.push('reload-preserves-content');

    const replacement = '덮어쓴 메모\n다음 줄\n';
    await saveText(replacement);
    assert.deepEqual(await fs.readdir(temporary), ['memo.txt']);
    checks.push('overwrite-one-file');

    const port = server.port;
    await stopServer(server);
    server = await startServer(file, port);
    const secondPid = server.process.pid;
    assert.notEqual(secondPid, firstPid);
    await page.reload();
    await loaded();
    assert.equal(await memo.inputValue(), replacement);
    checks.push('new-java-process-preserves-content');
    await page.screenshot({ path: path.join(evidenceDir, 'after-restart.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(evidenceDir, 'mobile.png'), fullPage: true });

    await saveText('');
    await page.reload();
    await loaded();
    assert.equal(await memo.inputValue(), '');
    checks.push('empty-save-and-reload');
    assert.deepEqual(pageErrors, []);

    const result = {
      status: 'passed', at: new Date().toISOString(), channel, browser: browser.version(),
      firstPid, secondPid, port, checks, pageErrors
    };
    await fs.writeFile(path.join(evidenceDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
    await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await fs.rmdir(temporary);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
