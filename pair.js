// pair.js
// Simple Pair Code generator for Baileys with optional basic key protection.
// Usage: set env PAIR_KEY to protect pairing page (recommended).
// After pairing, DILALK/creds.* files are saved in repo root.

const express = require('express');
const basicAuth = require('basic-auth');
const pino = require('pino');
const fs = require('fs-extra');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const AUTH_KEY = process.env.PAIR_KEY || ''; // set this in Deploy env for protection

// simple key auth middleware: either HTTP Basic (username:any / password=KEY) OR query ?key=KEY
function requireKey(req, res, next) {
  if (!AUTH_KEY) return next(); // no auth set => open (NOT recommended)
  // check query
  if (req.query && req.query.key === AUTH_KEY) return next();
  // check basic auth (username:any, password MUST === AUTH_KEY)
  const credentials = basicAuth(req);
  if (credentials && credentials.pass === AUTH_KEY) return next();
  res.set('WWW-Authenticate', 'Basic realm="PairSite"');
  return res.status(401).send('Unauthorized — provide key');
}

app.get('/', requireKey, (req, res) => {
  return res.send(`
    <center style="font-family:system-ui,Arial;">
      <h2>🤖 Money Heist - Pair Code Generator</h2>
      <form action="/pair" method="get">
        <label><b>Phone number (with country code, no +)</b></label><br/>
        <input name="number" placeholder="9477XXXXXXX" required style="padding:10px;width:260px;margin:10px"/><br/>
        <input type="hidden" name="key" value="${AUTH_KEY ? 'REQUIRED' : ''}" />
        <button type="submit" style="padding:10px 20px;background:#008000;color:#fff;border:none;border-radius:6px">Get Pair Code</button>
      </form>
      <p style="color:gray;font-size:13px;">Example: 94771234567 (no +). Keep this page open until pairing completes.</p>
    </center>
  `);
});

app.get('/pair', requireKey, async (req, res) => {
  const number = (req.query.number || '').trim();
  if (!/^\d{6,15}$/.test(number)) {
    return res.status(400).send('Invalid phone number. Example: 94771234567');
  }

  const sessionDir = './DILALK';
  try {
    await fs.ensureDir(sessionDir);
  } catch (e) {
    log.error({ err: e }, 'Failed to ensure session dir');
    return res.status(500).send('Server error (fs)');
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.macOS('Safari'),
      auth: state,
      version
    });

    // When credentials update, they are saved to DILALK/* by saveCreds
    sock.ev.on('creds.update', saveCreds);

    // connection updates log
    sock.ev.on('connection.update', (update) => {
      log.info({ update }, 'connection.update');
    });

    // request pairing code
    const code = await sock.requestPairingCode(number);
    log.info({ number, code }, 'pairing code generated');

    // send HTML with code and friendly instructions
    res.send(`
      <center style="font-family:system-ui,Arial;">
        <h2>🔑 Pair code for ${number}</h2>
        <h1 style="font-size:44px;color:#0b6623;margin:10px 0">${code}</h1>
        <p>Open WhatsApp → Linked Devices → Link device → Pair with phone number → Enter this code</p>
        <p style="color:gray">Keep this page open. Wait ~5-15s after entering the code for the session to be saved.</p>
        <hr style="width:60%;margin:20px auto">
        <p style="font-size:12px;color:#666">When paired, a credentials folder <code>/DILALK</code> will be created on the server. Copy its contents to your bot repo (or download manually).</p>
      </center>
    `);

    // optional: after pairing, you may want to close socket or leave running.
    // Here, we'll keep socket open for up to 5 minutes to let pairing complete.
    setTimeout(() => {
      try { sock.logout().catch(()=>{}); } catch(e){/*ignore*/ }
      log.info('Socket auto-closed after timeout');
    }, 5 * 60 * 1000);

  } catch (err) {
    log.error({ err }, 'Failed to generate pair code');
    console.error(err);
    return res.status(500).send('Failed to generate pairing code. See server logs.');
  }
});

app.listen(PORT, () => {
  log.info(`Pair site running on port ${PORT}`);
  console.log(`Pair site → http://localhost:${PORT}`);
});
