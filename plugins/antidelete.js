const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const tempFolder = path.join(__dirname, "../temp");
if (!fs.existsSync(tempFolder)) {
  fs.mkdirSync(tempFolder, { recursive: true });
}

const messageStore = new Map();
const mediaStore = new Map();

const CLEANUP_TIME = 10 * 60 * 1000;

/* 🔓 Unwrap ephemeral + view once safely */
function unwrapMessage(msg) {
  if (!msg) return null;

  if (msg.ephemeralMessage) {
    return unwrapMessage(msg.ephemeralMessage.message);
  }
  if (msg.viewOnceMessageV2) {
    return unwrapMessage(msg.viewOnceMessageV2.message);
  }
  if (msg.viewOnceMessage) {
    return unwrapMessage(msg.viewOnceMessage.message);
  }
  return msg;
}

/* 📦 Media type mapping */
function getBaileysType(type) {
  switch (type) {
    case "imageMessage": return "image";
    case "videoMessage": return "video";
    case "audioMessage": return "audio";
    case "stickerMessage": return "sticker";
    case "documentMessage": return "document";
    default: return null;
  }
}

/* 🧩 File extension */
function getExtension(type, msg) {
  switch (type) {
    case "imageMessage": return ".jpg";
    case "videoMessage": return ".mp4";
    case "audioMessage": return ".ogg";
    case "stickerMessage": return ".webp";
    case "documentMessage":
      return msg.documentMessage?.fileName
        ? path.extname(msg.documentMessage.fileName)
        : ".bin";
    default:
      return ".bin";
  }
}

module.exports = {
  name: "antidelete",

  /* 📥 Store messages */
  onMessage: async (conn, msg) => {
    try {
      if (!msg?.message || msg.key.fromMe) return;

      const keyId = msg.key.id;
      const remoteJid = msg.key.remoteJid;

      const cleanMsg = unwrapMessage(msg.message);
      if (!cleanMsg) return;

      messageStore.set(keyId, {
        key: msg.key,
        message: cleanMsg,
        remoteJid,
      });

      const type = Object.keys(cleanMsg)[0];
      const mediaType = getBaileysType(type);
      if (!mediaType) return;

      const stream = await downloadContentFromMessage(
        cleanMsg[type],
        mediaType
      );

      let buffer = Buffer.alloc(0);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      if (!buffer.length) return;

      const ext = getExtension(type, cleanMsg);
      const filePath = path.join(tempFolder, `${keyId}${ext}`);

      await fs.promises.writeFile(filePath, buffer);
      mediaStore.set(keyId, filePath);

      setTimeout(() => {
        messageStore.delete(keyId);
        if (mediaStore.has(keyId)) {
          try { fs.unlinkSync(mediaStore.get(keyId)); } catch {}
          mediaStore.delete(keyId);
        }
      }, CLEANUP_TIME);
    } catch (err) {
      console.log("❌ AntiDelete onMessage error:", err.message);
    }
  },

  /* 🗑️ Recover deleted messages */
  onDelete: async (conn, updates) => {
    for (const update of updates) {
      try {
        if (update.action !== "delete") continue;

        const key = update.key;
        if (!key?.id) continue;

        const keyId = key.id;
        const stored = messageStore.get(keyId);
        if (!stored) continue;

        // cleanup immediately
        messageStore.delete(keyId);

        const from = key.remoteJid;
        const sender = key.participant || from;

        const caption =
`🗑️ *Deleted Message Recovered*

👤 *Sender:* @${sender.split("@")[0]}
🕒 *Time:* ${new Date().toLocaleString()}`;

        const mediaPath = mediaStore.get(keyId);

        if (mediaPath && fs.existsSync(mediaPath)) {
          if (mediaPath.endsWith(".jpg")) {
            await conn.sendMessage(from, {
              image: { url: mediaPath },
              caption,
              mentions: [sender],
            });
          } else if (mediaPath.endsWith(".mp4")) {
            await conn.sendMessage(from, {
              video: { url: mediaPath },
              caption,
              mentions: [sender],
            });
          } else if (mediaPath.endsWith(".webp")) {
            await conn.sendMessage(from, {
              sticker: { url: mediaPath },
            });
            await conn.sendMessage(from, {
              text: caption,
              mentions: [sender],
            });
          } else if (mediaPath.endsWith(".ogg")) {
            await conn.sendMessage(from, {
              audio: { url: mediaPath },
              mimetype: "audio/ogg; codecs=opus",
            });
            await conn.sendMessage(from, {
              text: caption,
              mentions: [sender],
            });
          } else {
            await conn.sendMessage(from, {
              document: { url: mediaPath },
              caption,
              mentions: [sender],
            });
          }

          try { fs.unlinkSync(mediaPath); } catch {}
          mediaStore.delete(keyId);
          continue;
        }

        const msgObj = stored.message;
        const text =
          msgObj.conversation ||
          msgObj.extendedTextMessage?.text ||
          msgObj.imageMessage?.caption ||
          msgObj.videoMessage?.caption ||
          msgObj.documentMessage?.caption ||
          "";

        await conn.sendMessage(from, {
          text: text ? `${caption}\n\n📝 *Message:* ${text}` : caption,
          mentions: [sender],
        });
      } catch (err) {
        console.log("❌ AntiDelete onDelete error:", err.message);
      }
    }
  },
};
