import type { ExtendedContext } from "../typings/context";
import Telegraf = require("telegraf");
import HtmlUtils = require("../utils/html");
import TgUtils = require("../utils/tg");
import Log = require("../utils/log");
import UserStore = require('../stores/user');
import Files = require('fs');

let settings = {
    active: true, // If True, all messages from members posting anonymously as a channel will be deleted.
}

const { Composer: C } = Telegraf;
const { html } = HtmlUtils;
const { link } = TgUtils;
const { logError } = Log;
const { getAdmins } = UserStore;
const fs = Files;

const adminList: number[] = [];

const settingsFile = "./plugins/antianon.json";

// If a settings file exists, read it and update our settings with it.
fs.access(settingsFile, fs.F_OK, (err) => {
    if (err) {
        logError("[antianon] " + err.message);
        updateSettings();
        logError("[antianon] Creating new settings file.");
        return;
    }
    fs.readFile(settingsFile, "utf-8", (err, data) => {
        if (err) {
            logError("[antianon] " + err.message);
            return;
        }
        settings = JSON.parse(data.toString());
    });
});

// Update the settings file with our current settings object.
function updateSettings() {
    const data = JSON.stringify(settings);

    fs.writeFile(settingsFile, data, (err) => {
        if (err) {
            logError("[antianon] " + err.message);
            return;
        }
    });
}

export = C.mount("message", async (ctx: ExtendedContext, next) => {
    // Populate the list of Admins
    if (adminList.length < 1) {
        const admins = await getAdmins();
        //logError(admins);
        for (let i = 0; i < admins.length; i++) {
            adminList.push(admins[i].id);
        }
        //logError(adminList);
    }

    //Plugin Commands
    if (ctx.message?.entities?.[0].type === "bot_command") {
        const text = ctx.message?.text;
        const match = text.match(/^\/([^\s]+)\s?(.+)?/);
        let args = [];
        let command = "";
        if (match !== null) {
            if (match[1]) {
                command = match[1];
            }
            if (match[2]) {
                args = match[2].split(' ');
            }
        }

        // Command arguments (/antianon).
        if (command === "antianon") {
            if (adminList.indexOf(ctx.from?.id) >= 0) {
                if (args !== null) {
                    if (args[0] === "on") { // Enable Anti Anon (/antianon on).
                        settings.active = true;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`Anti Anon is now On.`
                        );
                    } else if (args[0] === "off") { // Disable Anti Anon (/antianon off).
                        settings.active = false;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`Anti Anon is now Off.`
                        );
                    } else if (args[0] === "settings") { // Print plugin settings (/antianon settings).
                        ctx.replyWithHTML(
                            html`Anti Anon settings:
                            <code>
                            active: ${settings.active}
                            </code>`
                        );
                    } else { // Invalid arguments, show Anti Anon commands.
                        ctx.replyWithHTML(
                            html`Anti Anon usage:
                            <code>/antianon argument value</code>\n
                            Anti Anon arguments:\n
                            <code>on</code> - Enables Anti Anon.
                            <code>off</code> - Disables Anti Anon.
                            <code>settings</code> - Shows the current settings for Anti Anon.`
                        );
                    }
                }
            }
            ctx.deleteMessage(ctx.message?.message_id);
        }
    }

    if (settings.active) {

        if (!ctx.from && ctx.from?.is_bot && (adminList.indexOf(ctx.from?.id) < 0)) {
            return next();
        }

        if (ctx.from?.id === 777000) {
            return Promise.all([
                ctx.deleteMessage(ctx.message?.message_id),
            ]).catch((err) => logError("[antianon] " + err.message));
        }
    } else {
        return next();
    }
});