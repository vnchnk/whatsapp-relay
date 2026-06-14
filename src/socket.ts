import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import pino from "pino";
import fs from "fs";
import path from "path";
import { state, AUTH_DIR } from "./state.js";

const logger = pino({ level: "warn" });

// Remembered so relink() can spin up a fresh connection with the same handler.
let onReadyCb: ((sock: WASocket) => void) | null = null;

/**
 * Connects to WhatsApp, mirrors live status into `state`, auto-reconnects on
 * transient drops, and calls `onReady` each time the socket opens. Auth state
 * is persisted to disk so the QR is only scanned once.
 */
export async function connect(onReady: (sock: WASocket) => void): Promise<void> {
  onReadyCb = onReady;
  const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({ version, auth, logger, printQRInTerminal: false });
  state.sock = sock;
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      state.status = "qr";
      state.qr = await QRCode.toDataURL(qr);
    }

    if (connection === "open") {
      state.status = "open";
      state.qr = null;
      const id = sock.user?.id ?? "";
      state.account = {
        number: id.split(":")[0].split("@")[0],
        name: sock.user?.name ?? "",
      };
      console.log(`✅ Connected as ${state.account.number} (${state.account.name})`);
      try {
        await refreshGroups();
      } catch (err) {
        console.error("Could not fetch groups:", err);
      }
      onReady(sock);
    }

    if (connection === "close") {
      state.status = "connecting";
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      if (loggedOut) {
        state.account = null;
        console.log("Logged out — re-pair via the panel (delete auth/ to reset).");
      } else {
        console.log(`Connection closed (${code}). Reconnecting…`);
        connect(onReady);
      }
    }
  });
}

/**
 * Unlinks the current device, wipes the stored session (keeping config.json),
 * and starts a fresh connection so a new pairing QR is produced.
 */
export async function relink(): Promise<void> {
  try {
    await state.sock?.logout();
  } catch {
    // already gone / offline — wipe locally anyway
  }
  for (const f of fs.readdirSync(AUTH_DIR)) {
    if (f !== "config.json") fs.rmSync(path.join(AUTH_DIR, f), { force: true });
  }
  state.account = null;
  state.groups = [];
  state.status = "connecting";
  if (onReadyCb) await connect(onReadyCb);
}

/** Refreshes the cached list of groups the account participates in. */
export async function refreshGroups(): Promise<void> {
  if (!state.sock) return;
  const groups = await state.sock.groupFetchAllParticipating();
  state.groups = Object.values(groups)
    .map((g) => ({ jid: g.id, name: g.subject ?? "(no name)" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
