// pair.js
const express = require("express");
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs-extra");
const app = express();
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send(`
    <h2>📱 WhatsApp Pair Code Generator</h2>
    <form action="/pair" method="get">
      <label>Enter your phone number with country code:</label><br/>
      <input name="number" placeholder="9477XXXXXXX" required/>
      <br/><br/>
      <button type="submit">Generate Pair Code</button>
    </form>
  `);
});

app.get("/pair", async (req, res) => {
  const number = req.query.number;
  if (!number) return res.send("Please provide number.");

  try {
    const { state, saveCreds } = await useMultiFileAuthState("./DILALK");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.macOS("Safari"),
      auth: state,
      version,
    });

    const code = await sock.requestPairingCode(number);
    console.log("Your pairing code:", code);
    res.send(`<h3>Pair this code in your WhatsApp:</h3><h1>${code}</h1>`);

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error(err);
    res.send("❌ Error generating pair code. Try again.");
  }
});

app.listen(port, () => console.log(`🌐 Pair site running on http://localhost:${port}`));
