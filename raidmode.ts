import type { ExtendedContext } from "../typings/context";
import Telegraf = require("telegraf");
import HtmlUtils = require("../utils/html");
import TgUtils = require("../utils/tg");
import Log = require("../utils/log");
import UserStore = require('../stores/user');
import Files = require('fs');

let settings = {
    active: false, // If True, all new members will be kicked.
    kickCooldown: 300, // Time before a kicked user can attempt to join the chat again in 5 minutes (300 seconds) by default.
    feedback: false // If True, it will post a message detailing why the user was removed.
}

const { Composer: C } = Telegraf;
const { html } = HtmlUtils;
const { link } = TgUtils;
const { logError } = Log;
const { getAdmins } = UserStore;
const fs = Files;

const adminList: number[] = [];

const settingsFile = "./plugins/raidmode.json";

// If a settings file exists, read it and update our settings with it.
fs.access(settingsFile, fs.F_OK, (err) => {
    if (err) {
        logError("[raidmode] " + err.message);
        updateSettings();
        logError("[raidmode] Creating new settings file.");
        return;
    }
    fs.readFile(settingsFile, "utf-8", (err, data) => {
        if (err) {
            logError("[raidmode] " + err.message);
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
            logError("[raidmode] " + err.message);
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

        // Command arguments (/raidmode).
        if (command === "raidmode") {
            if (adminList.indexOf(ctx.from?.id) >= 0) {
                if (args !== null) {
                    if (args[0] === "on") { // Enable Raid Mode (/raidmode on).
                        settings.active = true;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`Raid Mode is now On.`
                        );
                    } else if (args[0] === "off") { // Disable Raid Mode (/raidmode off).
                        settings.active = false;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`Raid Mode is now Off.`
                        );
                    } else if (args[0] === "cooldown") { // Change kick cooldown. (/raidmode cooldown <integer bigger or equal to 300>).
                        if (parseInt(args[1]) >= 300) {
                            settings.kickCooldown = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Raid Mode cooldown kick time is now ${settings.kickCooldown}.`
                            );
                        } else if (parseInt(args[1]) < 300) {
                            ctx.replyWithHTML(
                                html`Raid Mode cooldown kick time cannot be lower than 300 seconds (5 minutes).`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`Raid Mode cooldown kick time value is invalid.`
                            );
                        }
                    } else if (args[0] === "feedback") { // Change Raid Mode feedback (/raidmode feedback <true or false>).
                        if (args[1] == "true") {
                            settings.feedback = true;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Raid Mode feedback is enabled.`
                            );
                        } else if (args[1] == "false") {
                            settings.feedback = false;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Raid Mode feedback is disabled.`
                            );
                        }
                    } else if (args[0] === "settings") { // Print plugin settings (/raidmode settings).
                        ctx.replyWithHTML(
                            html`Raid Mode settings:
                            <code>
                            active: ${settings.active}
                            kickCooldown: ${settings.kickCooldown}
                            feedback: ${settings.feedback}
                            </code>`
                        );
                    } else { // Invalid arguments, show Raid Mode commands.
                        ctx.replyWithHTML(
                            html`Raid Mode usage:
                            <code>/raidmode argument value</code>\n
                            Raid Mode arguments:\n
                            <code>on</code> - Enables Raid Mode.
                            <code>off</code> - Disables Raid Mode.
                            <code>cooldown</code> - Changes the kick cooldown, in seconds, cannot be lower than 300 seconds (5 minutes).
                            <code>feedback</code> - Switches feedback messages on and off, boolean, only accepts true or false.
                            <code>settings</code> - Shows the current settings for Raid Mode.`
                        );
                    }
                }
            }
            ctx.deleteMessage(ctx.message?.message_id);
        }
    }

    const members = ctx.message?.new_chat_members?.filter(
        (x) => x.username !== ctx.me
    );
    if (!members || members.length === 0) {
        return next();
    }

    return Promise.all(
        members.map(async (x) => {
            if (settings.active) {
                if (settings.feedback) {
                    ctx.replyWithHTML(
                        html`User ${link(x)} has been kicked due to the chat being in Raid Mode.`
                    );
                }
                ctx.kickChatMember(x.id, Math.floor((Date.now() / 1000) + settings.kickCooldown));
            } else {
                return next();
            }
        })
    ).catch((err) => logError("[raidmode] " + err.message));
});