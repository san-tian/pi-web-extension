# pi-web-extension

A `pi` extension that helps an already-open TUI notice when the same shared session is continued from the `pidoxear` / Opencode web companion.

This package is explicitly a web companion accessory, not a general-purpose session-sync solution for all `pi` clients.

## What It Does

When installed in a `pi` TUI environment, the extension:
- watches the currently open shared session file
- detects when another client modifies that same session file
- shows a TUI notification and footer status when the current session changed externally
- provides `/shared-session-sync-refresh` to explain the supported no-core recovery path

Current notification text:
- `Current session changed in another client. Run /shared-session-sync-refresh for guidance.`

Current footer status:
- `External session update detected`

## What It Does Not Do

This package does **not** modify `pi` core.
Because of that, it does **not** provide a perfect in-place transcript refresh for an already-open TUI.

The current supported no-core flow is:
1. web companion continues the session
2. TUI detects that the current session changed externally
3. user reopens the session, typically via `/resume`

## Intended Use

Use this only when you are running:
- the `pidoxear` / Opencode web companion on one side
- a normal `pi` TUI session on the other side
- both clients against the same shared `~/.pi/agent/sessions/...` store

If you only use the TUI or only use the web companion, you probably do not need this extension.

## Install

Global install with `pi` package support:

```bash
pi install -l git:https://github.com/san-tian/pi-web-extension
```

Then reload `pi` resources or restart your TUI session.

## Manual Install

If you prefer the classic extension path:

```bash
git clone https://github.com/san-tian/pi-web-extension \
  ~/.pi/agent/extensions/shared-session-live-sync
```

Then run `/reload` inside `pi`, or restart `pi`.

## Verify

Open a TUI session, then continue the same shared session from the web companion.
You should see:
- a TUI notification about an external update
- the footer status `External session update detected`

You can then run:

```text
/shared-session-sync-refresh
```

The command will explain the current no-core recovery path and prefill `/resume`.

## Compatibility Note

This package is designed around the `pidoxear` / Opencode web companion workflow and the shared-session behavior documented in the author's fork.
It should be treated as a companion utility for that web setup.
