import { existsSync } from 'node:fs';
import path from 'node:path';
import { BOT_CHAT, hermesHome, hermesTask, selectedHermesProfile } from '../hermes.js';
import type { ProviderAdapter } from './types.js';

export const hermes: ProviderAdapter<undefined, { dataDir: string; home: string }> = {
  id: 'hermes',
  prepare: ({ dataDir }) => ({ dataDir, home: hermesHome() }),
  launch({ h, args, prompt, setup }) {
    let problem: string | undefined;
    let profile = 'default';
    try {
      profile = selectedHermesProfile(setup.home, h.info.model);
      const home = profile === 'default' ? setup.home : path.join(setup.home, 'profiles', profile);
      if (!existsSync(home)) throw new Error(`Hermes profile ${profile} is missing; select an existing bot`);
      // A saved ordinary CLI session must never pull this desk away from its Bot Mode chat.
      h.info.model = profile;
      h.persist();
      if (args.length) throw new Error('Hermes Bot Chat manages its launch flags; remove --agent-args');
    } catch (error) { problem = (error as Error).message; }
    // Native TUI builds can ignore --query-file during resume. Submit only after the canonical
    // viewer is ready, using the office's bracketed paste path (never shell/argv interpolation).
    h.pendingPrompt = problem ? undefined : prompt;
    return {
      args: ['-p', profile, 'chat', '--tui', '-c', BOT_CHAT],
      // Use Hermes' authenticated profile-aware discovery. Guessing a port from a PID loses the
      // profile route and can attach the wrong owner. No private homes or credential copies.
      env: { HERMES_HOME: setup.home, HERMES_TUI_GATEWAY_URL: '' },
      finishEnv() { if (problem) throw new Error(problem); },
    };
  },
  titleNoise: /^Hermes(?: Agent)?$/i,
  formatPrompt(h, text, cwd) {
    return text.startsWith('/') || h.info.status === 'needs_input' ? text : hermesTask(text, h.info.model || 'default', cwd);
  },
  screen: {
    title(h, title) {
      const marker = title.match(/^(⚠|⏳|✓)\s/)?.[1];
      if (!marker) return;
      h.bootBlocked = false;
      if (marker === '⏳') h.setStatus('working');
      else if (marker === '⚠') h.setStatus('needs_input');
      else if (h.info.status === 'working' || h.info.status === 'needs_input') h.setStatus('done');
      else if (h.info.status === 'starting') h.setStatus('idle');
      if (marker === '✓' && h.pendingPrompt) {
        const text = h.pendingPrompt;
        h.pendingPrompt = undefined;
        const error = h.prompt(text);
        if (error) { h.info.activity = error; h.setStatus('needs_input'); }
      }
    },
    blocked(text, early) {
      if (!early) return;
      if (/No session found matching ['"]Bot Chat/.test(text)) return 'Open this bot once in Hermes Desktop, then resume this worker';
      if (/Gateway could not start|Gateway protocol mismatch|Gateway unavailable/.test(text)) return 'Open the terminal to check the Hermes gateway connection';
    },
  },
};
