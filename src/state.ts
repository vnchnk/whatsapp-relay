import fs from "fs";
import path from "path";
import type { WASocket } from "@whiskeysockets/baileys";

const AUTH_DIR = process.env.AUTH_DIR ?? "auth";
const CONFIG_PATH = path.join(AUTH_DIR, "config.json");

export type Config = {
  source: string | null;
  dests: string[];
  forward: boolean;
  minDelay: number; // ms, lower bound of the random pause between sends
  maxDelay: number; // ms, upper bound
};
export type Group = { jid: string; name: string };

export type State = {
  status: "connecting" | "qr" | "open";
  qr: string | null; // data URL of the pairing QR, when status === "qr"
  account: { number: string; name: string } | null;
  groups: Group[];
  sock: WASocket | null;
  config: Config;
};

const DEFAULTS: Config = {
  source: process.env.SOURCE_GROUP || null,
  dests: (process.env.DEST_GROUPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  forward: true,
  minDelay: Number(process.env.MIN_DELAY_MS ?? 5000),
  maxDelay: Number(process.env.MAX_DELAY_MS ?? 10000),
};

/** Loads config.json, filling any missing fields from defaults (env bootstrap). */
function loadConfig(): Config {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as Partial<Config>;
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export const state: State = {
  status: "connecting",
  qr: null,
  account: null,
  groups: [],
  sock: null,
  config: loadConfig(),
};

export function saveConfig(cfg: Config): void {
  state.config = cfg;
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
