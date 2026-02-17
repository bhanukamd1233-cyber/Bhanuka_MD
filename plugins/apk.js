const { cmd } = require("../command");
const axios = require("axios");

cmd(
  {
    pattern: "apk",
    alias: ["android", "af"],
    react: "📦",
    desc: "Download Android APK from Aptoide",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { q, reply, from }) => {
    try {
      if (!q) return reply("❌ *Please provide an app name!*");

      await bot.sendMessage(from, {
        react: { text: "⏳", key: mek.key },
      });

      // ✅ FIXED API URL
      const apiUrl = `https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(
        q
      )}&limit=1`;

      const { data } = await axios.get(apiUrl);

      if (!data?.datalist?.list?.length) {
        return reply("⚠️ *No apps found with that name.*");
      }

      const app = data.datalist.list[0];

      // ✅ Safe APK URL fallback
      const apkUrl =
        app.file?.path_alt ||
        app.file?.path ||
        null;

      if (!apkUrl) {
        return reply("❌ *Download link not available for this app.*");
      }

      const sizeMB = app.size
        ? (app.size / 1048576).toFixed(2)
        : "Unknown";

      // ✅ Safe filename
      const safeName = app.name.replace(/[\\/:*?"<>|]/g, "");

      const caption =
        `📦 *APK DOWNLOADER*\n\n` +
        `📱 *App:* ${app.name}\n` +
        `🏷 *Package:* ${app.package}\n` +
        `⭐ *Rating:* ${app.stats?.rating?.avg || "N/A"}\n` +
        `📦 *Size:* ${sizeMB} MB`;

      await bot.sendMessage(
        from,
        {
          image: { url: app.icon },
          caption,
        },
        { quoted: mek }
      );

      await bot.sendMessage(
        from,
        {
          document: { url: apkUrl },
          fileName: `${safeName}.apk`,
          mimetype: "application/vnd.android.package-archive",
        },
        { quoted: mek }
      );

      await bot.sendMessage(from, {
        react: { text: "✅", key: mek.key },
      });
    } catch (err) {
      console.error("APK DOWNLOAD ERROR:", err);
      reply("❌ *Failed to download APK. Try another app name.*");
    }
  }
);
