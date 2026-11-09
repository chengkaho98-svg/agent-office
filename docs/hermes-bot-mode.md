# Hermes Bot Mode

Hire an existing Hermes Desktop bot by selecting **Hermes** and its profile in the hire dialog's **Bot** picker. The picker opens directly when Hermes is the default provider. The office terminal opens that profile's **Bot Chat**, the same named conversation Bot Mode opens. Each profile keeps its existing SOUL, memory, credentials and skills. The office does not create worker homes, copy secrets, or run a separate messaging gateway.

Start with a current Hermes installation on the office server:

```sh
agent-office /path/to/project --agent hermes
```

Open each bot once in Desktop before hiring it. If its Bot Chat is missing, open the bot in Desktop and resume the employee. We deliberately do not create an unrelated CLI chat as a fallback. A worker resolves the exact `Bot Chat` title again when resumed, including after compression; an old saved CLI session ID is ignored. An unset selection resolves the sticky active profile once and persists that explicit name on the worker.

The live terminal is Hermes' native TUI attached through authenticated gateway discovery. Desktop and the office are viewers of the same conversation. Transcript, tool output and input/approval controls remain native Hermes. Office desk badges follow the TUI's title markers: `⏳` working, `⚠` needs input, `✓` ready or finished. Closing a viewer does not mean cancelling the gateway task. Multiple employees hired with the same profile share the same bot: select different profiles for independent identities.

## Discord results

Office launch tasks and later tasks sent through the office's prompt action instruct the bot to save a UTF-8 report and execute:

```sh
hermes -p <selected-profile> send --to discord --file <absolute-report-path>
```

This uses that profile's existing Discord home channel and credentials. No channel ID or token is copied to the office. Reporting is agent-driven, not a guaranteed delivery queue: the bot must have terminal access, complete the task, and run the command successfully. The instruction requires it to check the result and report delivery errors in Bot Chat. Messages typed later directly into the TUI use the bot's standing instructions; ask for a Discord report there when needed. No destination is guessed when absent.

## Compatibility and migration

- Supports bots on the office machine's Hermes installation. Remote Desktop connections are not enumerated by this local profile catalogue.
- Requires native `chat --tui -c`, `profile list` and `send --to`. Tasks are submitted once the attached TUI reports ready, using bracketed paste; they are never interpolated into shell commands. The bot picker lists profiles, not model overrides. Configure each bot's model in Hermes.
- `--agent-args` is refused because session/profile overrides could detach the employee from Bot Mode.
- `HERMES_MAIN_HOME_OVERRIDE` or `HERMES_HOME` selects the fleet home. A profile-scoped home resolves back to its fleet root. Native gateway discovery supplies profile routing and authentication; the adapter clears inherited `HERMES_TUI_GATEWAY_URL` instead of guessing a port.
- Earlier integrations may have `.agent-office/hermes-homes/` and separate CLI sessions. Those files are preserved. This adapter uses the original profile and Bot Chat on the next launch; it does not merge old transcripts or overwrite SOUL files.
- A resumed bot retains its session working directory. The initial task names the office worktree explicitly so the bot can use it without changing conversation identity.
