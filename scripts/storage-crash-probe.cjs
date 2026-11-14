// Fault probe, not a durability guarantee. Exit 1 means observed data loss, 2 means inconclusive.
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const classpath = path.join(root, 'memo-core/build/classes/java/main');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tiny-memo-crash-'));
  const file = path.join(directory, 'memo.txt');
  const source = path.join(directory, 'CrashWriter.java');
  const outputDirectory = path.join(root, '.dev-cycle/verification', 'storage-' + randomUUID());
  const previous = Buffer.from('이전에 저장 완료한 메모\n', 'utf8');
  const targetBytes = 64 * 1024 * 1024;
  let child;
  let poll;
  let timeout;
  try {
    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.writeFile(source, `
import java.nio.file.Path;
import tiny.memo.core.MemoStore;
class CrashWriter {
  public static void main(String[] args) throws Exception {
    var store = new MemoStore(Path.of(args[1]));
    if (args[0].equals("read")) {
      System.out.println(store.read().length());
      return;
    }
    String content = "N".repeat(Integer.parseInt(args[2]));
    System.out.println("WRITING");
    System.out.flush();
    store.save(content);
    System.out.println("SAVED");
  }
}
`);
    await fs.writeFile(file, previous);
    const startedAt = new Date().toISOString();
    child = spawn('java', ['-Xmx256m', '-cp', classpath, source, 'write', file, String(targetBytes)], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let interruptedAtBytes = null;
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    poll = setInterval(async () => {
      if (!stdout.includes('WRITING') || interruptedAtBytes !== null) return;
      try {
        const { size } = await fs.stat(file);
        if (interruptedAtBytes === null && size !== previous.length && size < targetBytes) {
          interruptedAtBytes = size;
          child.kill('SIGKILL');
        }
      } catch {
        // Final evidence below determines whether the probe was conclusive.
      }
    }, 1);
    timeout = setTimeout(() => child.kill('SIGKILL'), 30000);
    const [exitCode, signal] = await once(child, 'exit');
    clearInterval(poll);
    clearTimeout(timeout);
    const remaining = await fs.readFile(file);
    const oldRetained = remaining.equals(previous);
    const newComplete = remaining.length === targetBytes && remaining.every(byte => byte === 78);
    const interrupted = interruptedAtBytes !== null && !stdout.includes('SAVED');
    const dataLoss = interrupted && !oldRetained && !newComplete;
    const restartedRead = execFileSync('java', ['-Xmx256m', '-cp', classpath, source, 'read', file], {
      windowsHide: true, encoding: 'utf8'
    }).trim();
    assert.match(restartedRead, /^\d+$/);
    const result = {
      startedAt, endedAt: new Date().toISOString(), platform: process.platform,
      head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      memoStoreSourceSha256: hash(await fs.readFile(path.join(root, 'memo-core/src/main/java/tiny/memo/core/MemoStore.java'))),
      status: dataLoss ? 'observed-data-loss' : 'inconclusive', durabilityPassed: false,
      childPid: child.pid, exitCode, signal, stdout, stderr, interruptedAtBytes,
      previousBytes: previous.length, targetBytes, remainingBytes: remaining.length,
      remainingSha256: hash(remaining), oldRetained, newComplete,
      restartedReadCharacters: Number(restartedRead),
      limitation: 'Forced process termination during overwrite; not a physical power-loss or storage-cache test.'
    };
    await fs.writeFile(path.join(outputDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ ...result, outputDirectory }, null, 2));
    process.exitCode = dataLoss ? 1 : 2;
  } finally {
    clearInterval(poll);
    clearTimeout(timeout);
    if (child && child.exitCode === null && child.signalCode === null) {
      const ended = once(child, 'exit');
      child.kill('SIGKILL');
      await ended;
    }
    for (const ownedFile of [file, source]) {
      await fs.unlink(ownedFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
    await fs.rmdir(directory);
  }
}

main().catch(error => { console.error(error); process.exitCode = 2; });
