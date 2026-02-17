const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers,
  downloadContentFromMessage
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const P = require('pino');
const express = require('express');
const path = require('path');
const { File } = require('megajs');

const config = require('./config');
const { sms } = require('./lib/msg');
const { getGroupAdmins } = require('./lib/functions');
const { commands, replyHandlers } = require('./command');

const app = express();
const port = process.env.PORT || 8000;

const prefix = '#';
const ownerNumber = ['94724258960'];
const authPath = path.join(__dirname, 'auth_info_baileys');

async function ensureSessionFile() {
  const credsPath = path.join(authPath, 'creds.json');

  if (!fs.existsSync(credsPath)) {
    if (!config.SESSION_ID) {
      console.error('❌ SESSION_ID missing');
      process.exit(1);
    }

    console.log('⬇️ Downloading session from MEGA...');
    const file = File.fromURL(`https://mega.nz/file/${config.SESSION_ID}`);

    file.download((err, data) => {
      if (err) return process.exit(1);
      fs.mkdirSync(authPath, { recursive: true });
      fs.writeFileSync(credsPath, data);
      connectToWA();
    });
  } else {
    connectToWA();
  }
}

async function connectToWA() {
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();

  const bhanuka = makeWASocket({
    logger: P({ level: 'silent' }),
    auth: state,
    version,
    browser: Browsers.macOS(),
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true
  });

  bhanuka.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        connectToWA();
      }
    }

    if (connection === 'open') {
      console.log('✅ BHANUKA-MD CONNECTED');

      await bhanuka.sendMessage(ownerNumber[0] + '@s.whatsapp.net', {
        image: { url: 'https://github.com/bhanukamd1233-cyber/Bhanuka_MD/blob/main/images/session%20complete.png?raw=true' },
        caption: `BHANUKA-MD Connected ✅\nPrefix: ${prefix}`
      });
    }
  });

  bhanuka.ev.on('creds.update', saveCreds);

  // ================= MESSAGE HANDLER =================
  bhanuka.ev.on('messages.upsert', async ({ messages }) => {
    const mek = messages[0];
    if (!mek || !mek.message) return;

    // unwrap ephemeral
    if (getContentType(mek.message) === 'ephemeralMessage') {
      mek.message = mek.message.ephemeralMessage.message;
    }

    // ================= STATUS HANDLER =================
    if (mek.key.remoteJid === 'status@broadcast') {
      if (config.AUTO_STATUS_SEEN === 'true') {
        await bhanuka.readMessages([mek.key]);
      }

      if (config.AUTO_STATUS_REACT === 'true') {
        const emojis = ['❤️','🔥','💯','😎','💎','💙'];
        await bhanuka.sendMessage('status@broadcast', {
          react: {
            text: emojis[Math.floor(Math.random() * emojis.length)],
            key: mek.key
          }
        });
      }
      return;
    }

    // ================= NORMAL MESSAGE =================
    const m = sms(bhanuka, mek);
    const type = getContentType(mek.message);
    const from = mek.key.remoteJid;
    const body =
      type === 'conversation'
        ? mek.message.conversation
        : mek.message[type]?.text || mek.message[type]?.caption || '';

    const isCmd = body.startsWith(prefix);
    const commandName = isCmd ? body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
    const args = body.split(' ').slice(1);
    const q = args.join(' ');

    const sender = mek.key.participant || mek.key.remoteJid;
    const senderNumber = sender.split('@')[0];
    const isGroup = from.endsWith('@g.us');
    const botNumber = bhanuka.user.id.split(':')[0];
    const isOwner = ownerNumber.includes(senderNumber);

    const groupMetadata = isGroup ? await bhanuka.groupMetadata(from) : null;
    const groupAdmins = isGroup ? getGroupAdmins(groupMetadata.participants) : [];

    const reply = (text) =>
      bhanuka.sendMessage(from, { text }, { quoted: mek });

    // ================= COMMAND HANDLER =================
    if (isCmd) {
      const cmd = commands.find(
        (c) => c.pattern === commandName || c.alias?.includes(commandName)
      );

      if (cmd) {
        try {
          await cmd.function(bhanuka, mek, m, {
            from,
            body,
            args,
            q,
            sender,
            senderNumber,
            isGroup,
            isOwner,
            groupAdmins,
            reply
          });
        } catch (err) {
          console.error('PLUGIN ERROR:', err);
        }
      }
    }

    // ================= AUTO REPLY HANDLERS =================
    for (const handler of replyHandlers) {
      if (handler.filter(body, { sender, message: mek })) {
        await handler.function(bhanuka, mek, m, { reply });
        break;
      }
    }
  });
}

ensureSessionFile();

app.get('/', (req, res) => {
  res.send('BHANUKA-MD Running ✅');
});

app.listen(port, () => {
  console.log(`🌐 Server running on port ${port}`);
});
