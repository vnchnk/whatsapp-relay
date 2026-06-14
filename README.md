# whatsapp-relay

Forwards every message from one WhatsApp group into one or more other groups,
with a small web control panel for setup. Built on
[Baileys](https://github.com/WhiskeySockets/Baileys) — it talks to WhatsApp Web
as a normal linked device (the official API can't access groups).

> ⚠️ Use a **secondary number**, not your main one. Relaying group messages is
> against WhatsApp's ToS; the random send delays reduce (but don't remove) the
> ban risk. The bot acts as your account — forwards appear to come from you.

## What the panel does

Open it in a browser (`http://localhost:8080`) and you can:

- **Pair** the account by scanning a QR code (no terminal needed).
- See **which account** the bot is logged in as.
- Pick the **source group** and one or more **destination groups**.
- Toggle the **"Forwarded"** tag on relayed messages.
- Set a **random delay** (min/max seconds) between sends.
- **Re-link** to a different account.

Config is stored in `auth/config.json` and applied live — no restart needed.

## Easiest: download and double-click (no install)

1. Go to the [**Releases**](https://github.com/vnchnk/whatsapp-relay/releases) page.
2. Download the file for your OS:
   - Windows → `WhatsAppRelay.exe`
   - macOS → `WhatsAppRelay-macos`
   - Linux → `WhatsAppRelay-linux`
3. Double-click it. A browser opens at <http://localhost:8080>.
4. Log in (`admin` / `admin`), scan the QR, pick your groups.

The bot keeps running while the window is open. It creates an `auth/` folder
next to itself to stay paired — keep that folder, and don't share it.

> macOS/Linux: if double-click is blocked, run `chmod +x WhatsAppRelay-macos`
> first. On macOS you may need to allow it in System Settings → Privacy & Security.

## Run with Docker

```bash
cp .env.example .env        # then set ADMIN_PASS / SESSION_SECRET
docker compose up -d --build
```

Open <http://localhost:8080>, log in, scan the QR, pick your groups.

## Run with Node

```bash
npm install
cp .env.example .env        # set ADMIN_PASS / SESSION_SECRET
npm start                   # panel on http://localhost:8080
```

## Configuration (`.env`)

| Var | Meaning |
|-----|---------|
| `PORT` | Panel port (default 8080) |
| `ADMIN_USER` / `ADMIN_PASS` | Panel login |
| `SESSION_SECRET` | Random string signing the login cookie |
| `AUTH_DIR` | Where the WhatsApp session is stored (default `auth`) |
| `SOURCE_GROUP` / `DEST_GROUPS` | Optional initial groups; afterwards managed from the panel |
| `MIN_DELAY_MS` / `MAX_DELAY_MS` | Initial send-delay bounds; afterwards managed from the panel |

The session in `auth/` keeps you paired across restarts. To find raw group JIDs
from the terminal instead of the panel, run `npm run groups`.

## How it works

A single process runs the Baileys socket (the relay) and an Express server (the
panel), sharing in-memory state. It listens for messages in the source group and
re-sends each to every destination group with a random pause in between. It never
reacts to destination groups, so there is no forwarding loop.

## Security notes

- The `auth/` folder is a **live WhatsApp session** — anyone with it can act as
  your account. It is gitignored; never commit or share it.
- The panel controls your WhatsApp. Protect it with a strong `ADMIN_PASS` and,
  if exposed beyond localhost, put it behind HTTPS.
