import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hermes } from '../src/server/providers/hermes.js';
import { fetchHermesProfiles, hermesHome, selectedHermesProfile } from '../src/server/hermes.js';
import { configuredProvider } from '../src/server/agents.js';
import type { WorkerHandle } from '../src/server/workers/types.js';

test('bot catalogue excludes headings, diagnostics and duplicate rows', async () => {
  const result = await fetchHermesProfiles('hermes', '/project', async (command, args, options) => {
    assert.equal(command, 'hermes');
    assert.deepEqual(args, ['profile', 'list']);
    assert.equal(options.timeout, 30_000);
    return { stdout: 'Warning: setup incomplete\n Profile Model Gateway Alias Distribution\n ─── ─── ───\n default model running — —\n ◆ixt_ceo model running — —\n stock_agent model stopped — —\n stock_agent model stopped — —\n Tip: hermes profile use name\n', stderr: '' };
  });
  assert.deepEqual(result.map((r) => r.id), ['default', 'ixt_ceo', 'stock_agent']);
  await assert.rejects(fetchHermesProfiles('hermes', '.', async () => ({ stdout: 'Error: unavailable', stderr: '' })));
});

test('launch keeps bot identity, resumes Bot Chat and preserves arbitrary task text', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'office-hermes-'));
  mkdirSync(path.join(home, 'profiles', 'stock_agent'), { recursive: true });
  const h = { info: { id: 'desk1', model: 'stock_agent' }, persist() {} } as WorkerHandle<undefined>;
  const prompt = 'Quotes " and `ticks` and $(command)\n第二行';
  const plan = hermes.launch({ h, args: [], prompt, resumeSessionId: 'old-cli-session', cwd: '/task', setup: { home, dataDir: home } });
  plan.finishEnv?.({});
  assert.deepEqual(plan.args.slice(0, 6), ['-p', 'stock_agent', 'chat', '--tui', '-c', 'Bot Chat']);
  assert.ok(!plan.args.includes('old-cli-session'));
  assert.ok(!plan.args.includes('--create-if-missing'));
  assert.equal(plan.env?.HERMES_HOME, home);
  assert.equal(plan.env?.HERMES_TUI_GATEWAY_URL, '');
  assert.equal(h.pendingPrompt, prompt);
  const body = hermes.formatPrompt!(h, prompt, '/task');
  assert.ok(body.startsWith(prompt));
  assert.match(body, /hermes -p stock_agent send --to discord --file/);
  assert.match(body, /Do not claim it was sent/);
});

test('sticky profile changes cannot change an employee; bad routes fail explicitly', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'office-hermes-'));
  mkdirSync(path.join(home, 'profiles', 'alpha'), { recursive: true });
  writeFileSync(path.join(home, 'active_profile'), '\uFEFFalpha\n');
  const h = { info: { id: 'desk2' }, persist() {} } as WorkerHandle<undefined>;
  const input = { h, args: [], cwd: '.', setup: { home, dataDir: home } };
  hermes.launch(input).finishEnv?.({});
  writeFileSync(path.join(home, 'active_profile'), 'default');
  assert.equal(hermes.launch(input).args[1], 'alpha');
  assert.equal(h.info.model, 'alpha');
  assert.throws(() => selectedHermesProfile(home, '../other'));
  assert.throws(() => hermes.launch({ ...input, args: ['-c', 'another'] }).finishEnv?.({}));
  assert.throws(() => hermes.launch({ ...input, h: { ...h, info: { ...h.info, model: 'missing' } } }).finishEnv?.({}));
});

test('profile environments resolve to the fleet root; Windows wrappers are Hermes', () => {
  const root = path.resolve('/fleet');
  assert.equal(hermesHome({ HERMES_HOME: path.join(root, 'profiles', 'alpha') }), root);
  assert.equal(configuredProvider('C:\\Hermes\\hermes.cmd'), 'hermes');
  assert.equal(configuredProvider('C:\\Hermes\\hermes.exe'), 'hermes');
});

test('native TUI title markers reflect work, approval and completion without guessing from output', () => {
  const h = { info: { status: 'idle' }, bootBlocked: false, setStatus(status: string) { this.info.status = status; } } as unknown as WorkerHandle<undefined>;
  hermes.screen?.title?.(h, '⏳ Bot Chat · model');
  assert.equal(h.info.status, 'working');
  hermes.screen?.title?.(h, '⚠ Bot Chat · model');
  assert.equal(h.info.status, 'needs_input');
  hermes.screen?.title?.(h, '✓ Bot Chat · model');
  assert.equal(h.info.status, 'done');
  hermes.screen?.title?.(h, 'Hermes');
  assert.equal(h.info.status, 'done');
});

test('a launch task waits for a ready Bot Chat, and window/tab titles cannot send it twice', () => {
  const sent: string[] = [];
  const h = { info: { status: 'idle' }, pendingPrompt: 'Exact "task"\n第二行', bootBlocked: false,
    setStatus(status: string) { this.info.status = status; }, prompt(text: string) { sent.push(text); } } as unknown as WorkerHandle<undefined>;
  hermes.screen!.title!(h, 'Hermes');
  hermes.screen!.title!(h, '⏳ Bot Chat');
  hermes.screen!.title!(h, '⚠ Bot Chat');
  assert.equal(sent.length, 0);
  hermes.screen!.title!(h, '✓ Bot Chat');
  hermes.screen!.title!(h, '✓ Bot Chat · model');
  assert.deepEqual(sent, ['Exact "task"\n第二行']);
  assert.equal(h.pendingPrompt, undefined);
  assert.equal(hermes.formatPrompt!(h, '/compact', '.'), '/compact');
  h.info.status = 'needs_input';
  assert.equal(hermes.formatPrompt!(h, 'yes', '.'), 'yes');
});
