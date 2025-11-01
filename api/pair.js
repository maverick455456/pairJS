import express from "express";
import fs from "fs-extra";
import pino from "pino";
import {
  default as makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`
    <center>
      <h2>🤖 WhatsApp Pair Code Generator</h2>
      <form action="/pair" method="get">
        <label><b>Enter your phone number (with country code):</b></label><br>
        <input name="number" placeholder="9477XXXXXXX" required style="padding:10px; width:250px; margin:10px;"/><br>
        <button type="submit" style="padding:10px 25px; background:green; color:white; border:none; border-radius:5px;">Get Pair Code</button>
      </form>
      <p style="color:gray; font-size:14px;">Example: 94771234567 (No + sign)</p>
    </center>
  `);
});

app.get("/pair", async (req, res) => {
  const number = req.query.number?.trim();
  if (!number) return res.send("❌ Please enter a valid number!");

  try {
    const sessionPath = "./DILALK";
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.macOS("Safari"),
      auth: state,
      version
    });

    const code = await sock.requestPairingCode(number);

    res.send(`
      <center>
        <h2>🔑 Pair Code for ${number}</h2>
        <h1 style="font-size:40px; color:green;">${code}</h1>
        <p>Open WhatsApp → Linked Devices → Pair with phone number → Enter this code ✅</p>
      </center>
    `);

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error(err);
    res.send("❌ Error generating pairing code. Check console logs.");
  }
});

app.listen(PORT, () =>
  console.log(`✅ Pair site running on http://localhost:${PORT}`)
);
