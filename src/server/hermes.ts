// Hermes Bot Mode owns identity and conversation state. The office is another viewer.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { isValidHermesProfile, type ModelOption } from '../shared/providers.js';
import type { ModelCommandRunner } from './models.js';

export const BOT_CHAT = 'Bot Chat';

export function hermesHome(env = process.env): string {
  const home = env.HERMES_MAIN_HOME_OVERRIDE || env.HERMES_HOME || (process.platform === 'win32'
    ? path.join(env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local'), `hermes${env.HERMES_DATA_DIR_SUFFIX || ''}`)
    : path.join(homedir(), `.hermes${env.HERMES_DATA_DIR_SUFFIX || ''}`));
  const resolved = path.resolve(home);
  return path.basename(path.dirname(resolved)) === 'profiles' ? path.dirname(path.dirname(resolved)) : resolved;
}

/** Resolve the sticky choice once; persist that explicit profile on the worker. */
export function selectedHermesProfile(home: string, selected?: string): string {
  if (selected) {
    if (!isValidHermesProfile(selected)) throw new Error('Invalid Hermes profile');
    return selected;
  }
  const active = path.join(home, 'active_profile');
  const name = existsSync(active) ? readFileSync(active, 'utf8').replace(/^\uFEFF/, '').trim() : 'default';
  if (!isValidHermesProfile(name)) throw new Error('Invalid Hermes active_profile; select a bot explicitly');
  return name;
}

export function hermesTask(prompt: string, profile: string, cwd: string): string {
  return `${prompt}\n\n[Agent Office task context]\n`
    + `You are the existing Hermes bot ${profile}. Keep your own identity, personality, memory and Bot Chat.\n`
    + `This task's working directory is ${JSON.stringify(cwd)}. Use that directory explicitly for this task; another viewer may have opened this conversation elsewhere.\n`
    + `When this task is finished, write its result to a UTF-8 report file and run: hermes -p ${profile} send --to discord --file <absolute-report-path>\n`
    + 'The user authorizes this completion report to this profile\'s configured Discord home channel. Quote the file path for your shell. Do not invent a destination or change channel settings. '
    + 'Check the command result; if delivery fails or no home channel is configured, report that failure here and keep the report file. Do not claim it was sent.\n';
}

/** Parse only rows in the CLI's documented Profile / Model / Gateway table. */
export async function fetchHermesProfiles(command: string, cwd: string, runner: ModelCommandRunner): Promise<ModelOption[]> {
  const { stdout } = await runner(command, ['profile', 'list'], { cwd, timeout: 30_000, maxBuffer: 1024 * 1024 });
  const rows: ModelOption[] = [];
  let table = false;
  for (const raw of stdout.replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (/^Profile\s+Model\s+Gateway\b/.test(line)) { table = true; continue; }
    if (!table || !line || /^[─\s-]+$/.test(line)) continue;
    const match = /^(◆\s*)?([a-zA-Z0-9][a-zA-Z0-9_-]*)\s+.+?\s+(running|stopped|not running|—)\s+/.exec(line);
    if (!match || !isValidHermesProfile(match[2]) || rows.some((r) => r.id === match[2])) continue;
    rows.push({ id: match[2], name: `${match[2]}${match[1] ? ' · active profile' : ''} · Bot Chat` });
  }
  if (!rows.length) throw new Error('Hermes bot catalogue unavailable; check hermes profile list');
  return rows;
}
