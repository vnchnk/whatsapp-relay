const SHELL = (body: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>WhatsApp Relay</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font: 15px/1.5 -apple-system, system-ui, sans-serif;
    background: #0b141a; color: #e9edef;
    padding: max(16px, env(safe-area-inset-top)) 16px 32px;
  }
  .wrap { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 8px 0 4px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #8696a0; margin: 24px 0 8px; }
  .card { background: #111b21; border: 1px solid #222d34; border-radius: 14px; padding: 16px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 10px; border-radius: 999px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .ok { background: #0c2a1c; color: #7ee2b8; } .ok .dot { background: #25d366; }
  .wait { background: #2a230c; color: #e2cf7e; } .wait .dot { background: #e2b007; }
  label.row { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid #1b262c; cursor: pointer; }
  label.row:last-child { border-bottom: 0; }
  label.row span { flex: 1; }
  input[type=radio], input[type=checkbox] { width: 20px; height: 20px; accent-color: #25d366; }
  input[type=range] { width: 100%; accent-color: #25d366; margin: 4px 0 12px; }
  input[type=text], input[type=password] {
    width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #2a3942;
    background: #0b141a; color: #e9edef; font-size: 16px;
  }
  button {
    font-size: 15px; font-weight: 600; padding: 12px 16px; border-radius: 10px;
    border: 0; cursor: pointer; background: #25d366; color: #0b141a;
  }
  button.ghost { background: #202c33; color: #e9edef; }
  button.sm { padding: 8px 12px; font-size: 13px; }
  button[disabled] { opacity: .6; pointer-events: none; }
  .spin { display: inline-block; width: 13px; height: 13px; vertical-align: -2px;
    border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%;
    animation: rot .7s linear infinite; }
  @keyframes rot { to { transform: rotate(360deg); } }
  #toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%) translateY(20px);
    background: #25d366; color: #0b141a; font-weight: 600; font-size: 14px;
    padding: 10px 18px; border-radius: 999px; opacity: 0; transition: .25s; pointer-events: none; }
  #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .btns { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  .topbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .topbar .actions { display: flex; gap: 8px; }
  .muted { color: #8696a0; font-size: 13px; }
  img.qr { width: 100%; max-width: 280px; border-radius: 12px; display: block; margin: 12px auto; image-rendering: pixelated; }
  a { color: #53bdeb; }
</style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;

export const loginPage = (error = ""): string =>
  SHELL(`
  <h1>WhatsApp Relay</h1>
  <p class="muted">Control panel for the forwarding bot.</p>
  <form method="post" action="/login" class="card" style="margin-top:16px">
    ${error ? `<p style="color:#f87171;margin:0 0 12px">${error}</p>` : ""}
    <label class="muted">Login</label>
    <input type="text" name="user" autocapitalize="off" autocomplete="username" style="margin:6px 0 14px">
    <label class="muted">Password</label>
    <input type="password" name="pass" autocomplete="current-password" style="margin:6px 0 18px">
    <button type="submit" style="width:100%">Sign in</button>
  </form>`);

export const dashboardPage = (): string =>
  SHELL(`
  <div class="topbar">
    <h1>WhatsApp Relay</h1>
    <form method="post" action="/logout"><button class="ghost sm">Sign out</button></form>
  </div>
  <div id="app"><p class="muted">Loading…</p></div>
  <div id="toast"></div>

<script>
const $ = (s) => document.querySelector(s);
let st = null;

async function load() {
  st = await (await fetch("/api/state")).json();
  render();
}

function render() {
  const a = st.account;
  const connected = st.status === "open";
  let html = "";

  // Status + account
  html += '<div class="card">';
  if (connected) {
    html += '<span class="pill ok"><span class="dot"></span>Connected</span>';
    html += '<p style="margin:12px 0 0">Bot account: <b>+' + (a ? a.number : "?") + '</b>' + (a && a.name ? ' · ' + esc(a.name) : '') + '</p>';
    html += '<p class="muted" style="margin:4px 0 0">All forwards are sent from this number.</p>';
    html += '<div class="btns" style="margin-top:14px"><button class="ghost sm" onclick="relink(this)">Re-link account</button></div>';
  } else if (st.status === "qr" && st.qr) {
    html += '<span class="pill wait"><span class="dot"></span>Login required</span>';
    html += '<p style="margin:12px 0 0">Scan the QR: WhatsApp → Linked devices → Link a device.</p>';
    html += '<img class="qr" src="' + st.qr + '">';
  } else {
    html += '<span class="pill wait"><span class="dot"></span>Connecting…</span>';
  }
  html += '</div>';

  if (connected) {
    const cfg = st.config;
    // Source
    html += '<h2>Source group</h2><div class="card">';
    if (!st.groups.length) html += '<p class="muted">No groups found. Tap ↻ Refresh.</p>';
    for (const g of st.groups) {
      html += '<label class="row"><input type="radio" name="src" value="' + g.jid + '"' +
        (cfg.source === g.jid ? ' checked' : '') + '><span>' + esc(g.name) + '</span></label>';
    }
    html += '</div>';

    // Destinations
    html += '<h2>Destination groups</h2><div class="card">';
    if (!st.groups.length) html += '<p class="muted">No groups found. Tap ↻ Refresh.</p>';
    for (const g of st.groups) {
      html += '<label class="row"><input type="checkbox" name="dst" value="' + g.jid + '"' +
        (cfg.dests.includes(g.jid) ? ' checked' : '') + '><span>' + esc(g.name) + '</span></label>';
    }
    html += '</div>';

    // Options: forward tag + delay sliders
    const minS = Math.round(cfg.minDelay / 1000), maxS = Math.round(cfg.maxDelay / 1000);
    html += '<h2>Options</h2><div class="card">';
    html += '<label class="row"><input type="checkbox" id="fwd"' + (cfg.forward ? ' checked' : '') +
      '><span>Show the "Forwarded" tag</span></label>';
    html += '<div style="padding:12px 4px 4px">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
      '<span>Random delay between sends</span><b id="dl">' + minS + '–' + maxS + ' s</b></div>' +
      '<label class="muted">Min</label>' +
      '<input type="range" id="min" min="0" max="60" step="1" value="' + minS + '" oninput="syncDelay(this)">' +
      '<label class="muted">Max</label>' +
      '<input type="range" id="max" min="0" max="60" step="1" value="' + maxS + '" oninput="syncDelay(this)">' +
      '</div></div>';

    html += '<div class="btns">' +
      '<button onclick="save(this)">Save</button>' +
      '<button class="ghost" onclick="refresh(this)">↻ Refresh groups</button></div>';
  }

  $("#app").innerHTML = html;
}

function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Keeps the two delay sliders coherent (max never below min) and updates the label.
function syncDelay(el){
  let mn = +$("#min").value, mx = +$("#max").value;
  if (mn > mx) {
    if (el && el.id === "min") { $("#max").value = mn; mx = mn; }
    else { $("#min").value = mx; mn = mx; }
  }
  $("#dl").textContent = mn + "–" + mx + " s";
}

let toastTimer;
function toast(text) {
  const t = $("#toast"); t.textContent = text; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// Shows a spinner inside a button while the action runs, then restores its label.
async function busy(btn, label, fn) {
  const original = btn.innerHTML; btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> ' + label;
  try { await fn(); } finally { btn.disabled = false; btn.innerHTML = original; }
}

async function save(btn) {
  await busy(btn, "Saving…", async () => {
    const source = (document.querySelector('input[name=src]:checked') || {}).value || null;
    const dests = [...document.querySelectorAll('input[name=dst]:checked')].map(e => e.value);
    const forward = $("#fwd").checked;
    const minDelay = (+$("#min").value) * 1000;
    const maxDelay = (+$("#max").value) * 1000;
    const r = await fetch("/api/config", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ source, dests, forward, minDelay, maxDelay }) });
    const j = await r.json();
    st.config = j.config;
    toast("Saved ✓  source → " + j.config.dests.length + " group(s)");
  });
}

async function refresh(btn) {
  await busy(btn, "Refreshing…", async () => {
    const before = st.groups.length;
    const r = await fetch("/api/refresh", { method:"POST" });
    const j = await r.json();
    if (j.groups) st.groups = j.groups;
    render();
    toast("Groups updated ✓  " + st.groups.length + " found");
  });
}

async function relink(btn) {
  if (!confirm("Unlink the current device and show a new QR? The bot will be offline until you scan it again.")) return;
  await busy(btn, "Unlinking…", async () => {
    await fetch("/api/relink", { method:"POST" });
    toast("Unlinked — scan the new QR");
    setTimeout(load, 1500);
  });
}

load();
// Poll while waiting for connection / QR so the panel updates itself.
setInterval(() => { if (!st || st.status !== "open") load(); }, 3000);
</script>`);
