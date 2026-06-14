import express, { type Request } from "express";
import crypto from "crypto";
import { state, saveConfig, type Config } from "./state.js";
import { refreshGroups, relink } from "./socket.js";
import { loginPage, dashboardPage } from "./views.js";

const USER = process.env.ADMIN_USER ?? "admin";
const PASS = process.env.ADMIN_PASS ?? "admin";
const SECRET = process.env.SESSION_SECRET ?? "insecure-default-change-me";
const PORT = Number(process.env.PORT ?? 8080);

// Stateless session token: changes if creds or secret change → old cookies die.
const TOKEN = crypto.createHmac("sha256", SECRET).update(`${USER}:${PASS}`).digest("hex");

function authed(req: Request): boolean {
  const m = (req.headers.cookie ?? "").match(/(?:^|;\s*)auth=([a-f0-9]+)/);
  return !!m && m[1] === TOKEN;
}

export function startServer(): void {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get("/login", (_req, res) => res.send(loginPage()));
  app.post("/login", (req, res) => {
    if (req.body.user === USER && req.body.pass === PASS) {
      res.setHeader(
        "Set-Cookie",
        `auth=${TOKEN}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax`,
      );
      return res.redirect("/");
    }
    res.send(loginPage("Невірний логін або пароль"));
  });
  app.post("/logout", (_req, res) => {
    res.setHeader("Set-Cookie", "auth=; Path=/; Max-Age=0");
    res.redirect("/login");
  });

  // Everything below requires a valid session.
  app.use((req, res, next) => (authed(req) ? next() : res.redirect("/login")));

  app.get("/", (_req, res) => res.send(dashboardPage()));

  app.get("/api/state", (_req, res) =>
    res.json({
      status: state.status,
      qr: state.qr,
      account: state.account,
      groups: state.groups,
      config: state.config,
    }),
  );

  app.post("/api/config", (req, res) => {
    const body = req.body as Partial<Config>;
    let minDelay = Number.isFinite(body.minDelay) ? Number(body.minDelay) : state.config.minDelay;
    let maxDelay = Number.isFinite(body.maxDelay) ? Number(body.maxDelay) : state.config.maxDelay;
    minDelay = Math.max(0, minDelay);
    maxDelay = Math.max(minDelay, maxDelay); // never below min
    saveConfig({
      source: body.source || null,
      dests: Array.isArray(body.dests) ? body.dests : [],
      forward: body.forward !== false,
      minDelay,
      maxDelay,
    });
    res.json({ ok: true, config: state.config });
  });

  app.post("/api/refresh", async (_req, res) => {
    try {
      await refreshGroups();
      res.json({ ok: true, groups: state.groups });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/relink", async (_req, res) => {
    try {
      await relink();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.listen(PORT, () => console.log(`Panel listening on :${PORT}`));
}
