// Run the real dev-cycle CLI and reject skipped, cached, stale, or zero-test results.
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const cli = path.resolve(process.argv[2]);
const output = path.join(root, '.dev-cycle/reports', 'verify-' + randomUUID());
fs.mkdirSync(output, { recursive: true });

function invoke(name, command, extra = []) {
  const args = [cli, command, root, ...extra, '--json'];
  console.log('node ' + args.map(arg => JSON.stringify(arg)).join(' '));
  const result = spawnSync(process.execPath, args, {
    cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024
  });
  fs.writeFileSync(path.join(output, name + '.json'), result.stdout || '');
  fs.writeFileSync(path.join(output, name + '.stderr.log'), result.stderr || '');
  if (result.error) throw result.error;
  return { exitCode: result.status, value: JSON.parse(result.stdout) };
}

try {
  const preview = invoke('dry-run', 'test', ['--dry-run']);
  assert.equal(preview.exitCode, 0);
  const test = invoke('test', 'test');
  // Always ask report about the latest test, including a failed execution.
  const report = invoke('report', 'report');
  const run = test.value;
  fs.writeFileSync(path.join(output, 'report.md'), report.value.markdown || '');
  assert.equal(test.exitCode, 0);
  assert.equal(report.exitCode, 0);
  assert.equal(run.status, 'succeeded');
  assert.equal(run.execution.exitCode, 0);
  assert.equal(run.codeState, 'unchanged');
  assert.equal(run.comparison.baseRef, 'main');
  assert.equal(run.comparison.head, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
  assert.equal(run.comparison.baseCommit, execFileSync('git', ['rev-parse', 'main'], { cwd: root, encoding: 'utf8' }).trim());
  assert.equal(report.value.freshness.status, 'current');
  assert.equal(report.value.run.runId, run.runId);
  assert.deepEqual(report.value.run.evidence.counts, run.evidence.counts);
  assert.ok(run.evidence.counts.tests > 0);
  for (const key of ['failures', 'errors', 'skipped']) assert.equal(run.evidence.counts[key], 0);
  for (const module of ['memo-core', 'memo-web']) {
    assert.ok(run.execution.tasks.some(task => task.task === ':' + module + ':test' && task.outcome === 'EXECUTED'));
    assert.ok(run.evidence.files.some(file => file.path.startsWith(module + '/') && file.state === 'fresh'));
  }
  const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  for (const file of run.evidence.files) {
    assert.equal(file.state, 'fresh');
    assert.equal(hash(path.join(root, file.path)), hash(path.join(path.dirname(run.recordPath), file.copiedPath)));
  }
  console.log(JSON.stringify({ status: 'verified', runId: run.runId, head: run.comparison.head,
    counts: run.evidence.counts, freshness: report.value.freshness.status, output }, null, 2));
} catch (error) {
  console.error(error);
  console.error('Evidence directory: ' + output);
  process.exitCode = 1;
}
