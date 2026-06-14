import type { WASocket } from "@whiskeysockets/baileys";
import { state } from "./state.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Random pause (ms) between sends, read live from the panel config. */
function jitter(): number {
  const { minDelay, maxDelay } = state.config;
  const span = Math.max(0, maxDelay - minDelay);
  return minDelay + Math.floor(Math.random() * span);
}

/** Attaches the forwarding handler. Reads source/dest live from state.config. */
export function startRelay(sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const { source, dests, forward } = state.config;
    if (!source || dests.length === 0) return;

    for (const msg of messages) {
      // Only the source group. No loop risk: we never react to DEST groups.
      if (msg.key.remoteJid !== source || !msg.message) continue;

      console.log(`→ forwarding ${msg.key.id} to ${dests.length} group(s)`);
      for (const dest of dests) {
        // Pause before every send (including the first) so nothing goes instantly.
        await sleep(jitter());
        try {
          await sock.sendMessage(dest, { forward: msg, force: forward });
        } catch (err) {
          console.error(`Failed to forward to ${dest}:`, err);
        }
      }
    }
  });
}
