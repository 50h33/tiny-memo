// Run after Gradle build. Pass an external Playwright package path if it is not on NODE_PATH.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
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
    await stopServer({ process });
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
  const playwrightSource = process.argv[2] || 'playwright';
  const playwright = require(playwrightSource);
  const playwrightVersion = require(`${playwrightSource}/package.json`).version;
  const target = process.argv[3] || 'chrome';
  const launchers = {
    chrome: { browserType: playwright.chromium, options: { channel: 'chrome' } },
    msedge: { browserType: playwright.chromium, options: { channel: 'msedge' } },
    firefox: { browserType: playwright.firefox, options: {} },
    webkit: { browserType: playwright.webkit, options: {} }
  };
  const launcher = launchers[target];
  if (!launcher) throw new Error('Browser must be one of: chrome, msedge, firefox, webkit');
  const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-') + '-' + process.pid;
  const evidenceDir = path.join(root, '.dev-cycle/verification', `browser-${target}`, runId);
  await fs.mkdir(evidenceDir, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'tiny-memo-browser-'));
  const file = path.join(temporary, 'memo.txt');
  const checks = [];
  let server;
  let browser;
  let result;
  let failure;
  try {
    server = await startServer(file);
    const firstPid = server.process.pid;
    browser = await launcher.browserType.launch({ ...launcher.options, headless: true });
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

    result = {
      status: 'passed', at: new Date().toISOString(), target,
      runtime: target === 'webkit' ? 'Playwright WebKit engine on Windows (not Safari or macOS)' : target,
      playwrightVersion, browserVersion: browser.version(), platform: `${process.platform} ${os.release()}`,
      firstPid, secondPid, port, checks, pageErrors
    };
  } catch (error) {
    failure = error;
  } finally {
    const cleanup = [
      () => browser?.close(),
      () => stopServer(server),
      () => fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; }),
      () => fs.rmdir(temporary)
    ];
    for (const action of cleanup) {
      try {
        await action();
      } catch (error) {
        failure ??= error;
      }
    }
  }
  if (failure) {
    result = {
      status: 'failed', at: new Date().toISOString(), target,
      runtime: target === 'webkit' ? 'Playwright WebKit engine on Windows (not Safari or macOS)' : target,
      playwrightVersion, platform: `${process.platform} ${os.release()}`, checks,
      error: failure.stack || String(failure)
    };
  }
  await fs.writeFile(path.join(evidenceDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ evidenceDir, ...result }, null, 2));
  if (failure) throw failure;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
