import fs from "node:fs"
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent"

const STATUS_KEY = "shared-session-live-sync"
const REFRESH_COMMAND = "shared-session-sync-refresh"
const REFRESH_GRACE_MS = 1500
const WATCH_INTERVAL_MS = 1000
const NOTIFY_COOLDOWN_MS = 5000

export default function sharedSessionLiveSync(pi: ExtensionAPI) {
  let currentCtx: ExtensionContext | undefined
  let currentSessionFile: string | undefined
  let currentSignature: string | undefined
  let unwatch: (() => void) | undefined
  let localTurnActive = false
  let lastLocalActivityAt = 0
  let refreshInFlight = false
  let pendingExternalRefresh = false
  let notifyAfter = 0

  const themeStatus = (ctx: ExtensionContext, text: string) => ctx.ui.theme.fg("dim", text)

  const updateStatus = (text?: string) => {
    if (!currentCtx?.hasUI) return
    currentCtx.ui.setStatus(STATUS_KEY, text ? themeStatus(currentCtx, text) : undefined)
  }

  const sessionSignature = async (sessionFile: string | undefined) => {
    if (!sessionFile) return
    try {
      const stat = await fs.promises.stat(sessionFile)
      return `${stat.size}:${stat.mtimeMs}`
    } catch {
      return undefined
    }
  }

  const syncBaseline = async () => {
    currentSignature = await sessionSignature(currentSessionFile)
  }

  const clearWatcher = () => {
    if (!unwatch) return
    unwatch()
    unwatch = undefined
  }

  const onExternalChange = async () => {
    const next = await sessionSignature(currentSessionFile)
    if (!next || next === currentSignature) return
    currentSignature = next

    const localWriteWindow = localTurnActive || Date.now() - lastLocalActivityAt < REFRESH_GRACE_MS
    if (localWriteWindow) return

    pendingExternalRefresh = true
    updateStatus("External session update detected")
    if (!currentCtx?.hasUI) return

    const now = Date.now()
    if (now < notifyAfter) return
    currentCtx.ui.notify(
      "Current session changed in another client. Run /shared-session-sync-refresh for guidance.",
      "info",
    )
    notifyAfter = now + NOTIFY_COOLDOWN_MS
  }

  const watchSessionFile = async (ctx: ExtensionContext) => {
    currentCtx = ctx
    currentSessionFile = ctx.sessionManager.getSessionFile() || undefined
    clearWatcher()
    await syncBaseline()

    if (!currentSessionFile) {
      updateStatus(undefined)
      return
    }

    fs.watchFile(currentSessionFile, { interval: WATCH_INTERVAL_MS }, () => {
      void onExternalChange()
    })
    unwatch = () => fs.unwatchFile(currentSessionFile!)
    updateStatus("Live shared-session sync ready")
  }

  pi.registerCommand(REFRESH_COMMAND, {
    description: "Explain how to reload the current shared session from disk",
    handler: async (args, ctx: ExtensionCommandContext) => {
      const sessionFile = currentSessionFile || ctx.sessionManager.getSessionFile() || undefined
      if (!sessionFile) {
        refreshInFlight = false
        pendingExternalRefresh = false
        ctx.ui.notify("Current session is ephemeral; nothing to refresh from disk.", "warning")
        updateStatus(undefined)
        return
      }

      refreshInFlight = false
      const hint = args.trim() === "silent"
        ? "External session update detected. Use /resume to reopen the current session and load the latest transcript."
        : `Current session file changed externally:\n${sessionFile}\n\nUse /resume to reopen this session and load the latest transcript.`
      ctx.ui.notify(hint, "info")
      ctx.ui.setEditorText("/resume")
    },
  })

  pi.on("session_start", async (_event, ctx) => {
    localTurnActive = false
    pendingExternalRefresh = false
    refreshInFlight = false
    notifyAfter = 0
    await watchSessionFile(ctx)
  })

  pi.on("session_switch", async (_event, ctx) => {
    localTurnActive = false
    pendingExternalRefresh = false
    refreshInFlight = false
    notifyAfter = 0
    await watchSessionFile(ctx)
  })

  pi.on("agent_start", async (_event, ctx) => {
    currentCtx = ctx
    localTurnActive = true
    lastLocalActivityAt = Date.now()
  })

  pi.on("agent_end", async (_event, ctx) => {
    currentCtx = ctx
    localTurnActive = false
    lastLocalActivityAt = Date.now()
    await syncBaseline()
    if (pendingExternalRefresh) {
      updateStatus("External session update detected")
      return
    }
    updateStatus("Live shared-session sync ready")
  })

  pi.on("session_shutdown", async () => {
    clearWatcher()
  })
}
