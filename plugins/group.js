const { cmd } = require("../command");
const { getGroupAdmins } = require("../lib/functions");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

/* ================= UTILS ================= */

function getTargetUser(mek, quoted, args) {
    if (mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
        return mek.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    if (quoted?.sender) return quoted.sender;
    if (args[0]) return args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    return null;
}

/* ================= KICK ================= */

cmd({
    pattern: "kick",
    react: "👢",
    desc: "Kick user from group",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, reply, participants, quoted, args }) => {

    if (!isGroup) return reply("❌ Group only command");
    if (!isAdmins) return reply("❌ Admins only");

    const target = getTargetUser(mek, quoted, args);
    if (!target) return reply("❌ Mention or reply to a user");

    const admins = getGroupAdmins(participants);
    if (admins.includes(target)) return reply("❌ I can’t kick an admin");

    await conn.groupParticipantsUpdate(m.chat, [target], "remove");
    reply(`✅ Kicked @${target.split("@")[0]}`, { mentions: [target] });
});

/* ================= TAGALL ================= */

cmd({
    pattern: "tagall",
    react: "📢",
    desc: "Tag all members",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, reply, participants }) => {

    if (!isGroup) return reply("❌ Group only");
    if (!isAdmins) return reply("❌ Admins only");

    const mentions = participants.map(p => p.id);
    const text = "*📢 Attention Everyone:*\n\n" +
        mentions.map(j => `@${j.split("@")[0]}`).join(" ");

    reply(text, { mentions });
});

/* ================= SET GROUP PP ================= */

cmd({
    pattern: "setpp",
    desc: "Set group profile picture",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, reply, quoted }) => {

    if (!isGroup) return reply("❌ Group only");
    if (!isAdmins) return reply("❌ Admins only");
    if (!quoted?.message?.imageMessage)
        return reply("🖼️ Reply to an image");

    try {
        const buffer = await downloadMediaMessage(
            quoted,
            "buffer",
            {},
            { logger: console }
        );
        await conn.updateProfilePicture(m.chat, buffer);
        reply("✅ Group profile picture updated");
    } catch (e) {
        console.error(e);
        reply("❌ Failed to update profile picture");
    }
});

/* ================= ADMINS ================= */

cmd({
    pattern: "admins",
    react: "👑",
    desc: "List group admins",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, reply, participants }) => {

    if (!isGroup) return reply("❌ Group only");

    const admins = participants.filter(p => p.admin);
    const text = "*👑 Group Admins:*\n\n" +
        admins.map(a => `@${a.id.split("@")[0]}`).join("\n");

    reply(text, { mentions: admins.map(a => a.id) });
});

/* ================= ADD ================= */

cmd({
    pattern: "add",
    alias: ["invite"],
    react: "➕",
    desc: "Add user to group",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, reply, args }) => {

    if (!isGroup) return reply("❌ Group only");
    if (!isAdmins) return reply("❌ Admins only");
    if (!args[0]) return reply("❌ Provide phone number");

    const target = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    try {
        await conn.groupParticipantsUpdate(m.chat, [target], "add");
        reply(`✅ Added @${target.split("@")[0]}`, { mentions: [target] });
    } catch (e) {
        console.error(e);
        reply("❌ Failed to add user");
    }
});

/* ================= PROMOTE / DEMOTE ================= */

cmd({
    pattern: "promote",
    react: "⬆️",
    desc: "Promote user to admin",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, reply, quoted, args }) => {

    if (!isGroup || !isAdmins) return reply("❌ Admins only");

    const target = getTargetUser(mek, quoted, args);
    if (!target) return reply("❌ Mention a user");

    await conn.groupParticipantsUpdate(m.chat, [target], "promote");
    reply(`✅ Promoted @${target.split("@")[0]}`, { mentions: [target] });
});

cmd({
    pattern: "demote",
    react: "⬇️",
    desc: "Demote admin",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, reply, quoted, args }) => {

    if (!isGroup || !isAdmins) return reply("❌ Admins only");

    const target = getTargetUser(mek, quoted, args);
    if (!target) return reply("❌ Mention a user");

    await conn.groupParticipantsUpdate(m.chat, [target], "demote");
    reply(`✅ Demoted @${target.split("@")[0]}`, { mentions: [target] });
});

/* ================= OPEN / CLOSE ================= */

cmd({
    pattern: "open",
    alias: ["unmute"],
    react: "🔓",
    desc: "Unmute group",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, reply }) => {

    if (!isGroup || !isAdmins) return reply("❌ Admins only");
    await conn.groupSettingUpdate(m.chat, "not_announcement");
    reply("✅ Group unmuted");
});

cmd({
    pattern: "close",
    alias: ["mute", "lock"],
    react: "🔒",
    desc: "Mute group",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, reply }) => {

    if (!isGroup || !isAdmins) return reply("❌ Admins only");
    await conn.groupSettingUpdate(m.chat, "announcement");
    reply("✅ Group muted");
});

/* ================= LINK ================= */

cmd({
    pattern: "revoke",
    react: "♻️",
    desc: "Reset invite link",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, reply }) => {

    if (!isGroup || !isAdmins) return reply("❌ Admins only");
    await conn.groupRevokeInvite(m.chat);
    reply("✅ Invite link reset");
});

cmd({
    pattern: "grouplink",
    alias: ["link"],
    react: "🔗",
    desc: "Get group invite link",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, reply }) => {

    if (!isGroup) return reply("❌ Group only");
    const code = await conn.groupInviteCode(m.chat);
    reply(`🔗 https://chat.whatsapp.com/${code}`);
});

/* ================= SUBJECT / DESC ================= */

cmd({
    pattern: "setsubject",
    react: "✏️",
    desc: "Change group name",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, args, reply }) => {

    if (!isGroup || !isAdmins) return reply("❌ Admins only");
    if (!args.length) return reply("❌ Provide group name");

    await conn.groupUpdateSubject(m.chat, args.join(" "));
    reply("✅ Group name updated");
});

cmd({
    pattern: "setdesc",
    react: "📝",
    desc: "Change group description",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, args, reply }) => {

    if (!isGroup || !isAdmins) return reply("❌ Admins only");
    if (!args.length) return reply("❌ Provide description");

    await conn.groupUpdateDescription(m.chat, args.join(" "));
    reply("✅ Group description updated");
});

/* ================= GROUP INFO ================= */

cmd({
    pattern: "groupinfo",
    alias: ["ginfo"],
    react: "📄",
    desc: "Show group info",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, reply }) => {

    if (!isGroup) return reply("❌ Group only");

    const meta = await conn.groupMetadata(m.chat);
    const admins = meta.participants.filter(p => p.admin);
    const owner = meta.owner || admins.find(a => a.admin === "superadmin")?.id;

    const text =
        `👥 *${meta.subject}*\n\n` +
        `🆔 ${meta.id}\n` +
        `👤 Members: ${meta.participants.length}\n` +
        `🛡️ Admins: ${admins.length}\n` +
        `📅 Created: ${new Date(meta.creation * 1000).toLocaleString()}\n\n` +
        `📝 ${meta.desc || "No description"}`;

    reply(text, { mentions: owner ? [owner] : [] });
});
