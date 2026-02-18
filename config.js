const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}
module.exports = {
SESSION_ID: process.env.SESSION_ID || "30pj2ZyS#BfM1f9lsGAjeSCTmdb-LQlafsMupqli34KKS7bZ1o2s",
ALIVE_IMG: process.env.ALIVE_IMG || "https://github.com/bhanukamd1233-cyber/Bhanuka_MD/blob/main/images/alive%20msg.png?raw=true",
ALIVE_MSG: process.env.ALIVE_MSG || "*Hello👋 BHANUKA-MD Is Alive Now😍*",
BOT_OWNER: '94724258960',  // Replace with the owner's phone number



};
