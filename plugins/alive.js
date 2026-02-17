const { cmd } = require("../command");
const config = require("../config");

cmd(
  {
    pattern: "alive",
    desc: "Check bot online status",
    category: "main",
    filename: __filename,
  },
  async (bhanuka, mek, m, { from, reply }) => {
    try {
      const image = config.ALIVE_IMG;
      const message = config.ALIVE_MSG || "*🤖 BHANUKA-MD is Online!*";

      // If no image, send text only
      if (!image) {
        return reply(message);
      }

      await bhanuka.sendMessage(
        from,
        {
          image: { url: image },
          caption: message,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error("ALIVE CMD ERROR:", err);
      reply("❌ Failed to send alive message.");
    }
  }
);
