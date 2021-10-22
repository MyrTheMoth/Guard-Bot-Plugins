import type { ExtendedContext } from "../typings/context";
import type { User } from "telegraf/typings/telegram-types";
import Telegraf = require("telegraf");
import HtmlUtils = require("../utils/html");
import TgUtils = require("../utils/tg");
import Log = require("../utils/log");
import UserStore = require('../stores/user');
import Files = require('fs');

let settings = {
    active: true, // If True, Bot will mute users who post too many messages too quickly.
    mutingTime: 300 // Time a slowed user will be muted for in seconds, 5 minutes (300 seconds) by default.
}

// Permissions for muted user.
const mutedOptions = {
    can_send_messages: true,
    can_send_media_messages: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false
}

const { Composer: C } = Telegraf;
const { html } = HtmlUtils;
const { link } = TgUtils;
const { logError } = Log;
const { getAdmins } = UserStore;
const fs = Files;

type Restricted = {
    user: User;
    chat: string;
};

const restricting = (
    ctx: ExtendedContext,
    x: User,
): Restricted => {
    const s = {
        user: x,
        chat: "",
    };
    return s;
};

const restrictList: Restricted[] = [];

const adminList: number[] = [];

const settingsFile = "./plugins/newrestrict.json";

// If a settings file exists, read it and update our settings with it.
fs.access(settingsFile, fs.F_OK, (err) => {
    if (err) {
        logError("[newrestrict] " + err.message);
        updateSettings();
        logError("[slowmode] Creating new settings file.");
        return;
    }
    fs.readFile(settingsFile, "utf-8", (err, data) => {
        if (err) {
            logError("[newrestrict] " + err.message);
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
            logError("[newrestrict] " + err.message);
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

    //Plugin Commands.
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

        // Command arguments (/newrestrict).
        if (command === "newrestrict") {
            if (adminList.indexOf(ctx.from?.id) >= 0) {
                if (args !== null) {
                    if (args[0] === "on") { // Enable New Restrict (/newrestrict on).
                        settings.active = true;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`New Restrict is now On.`
                        );
                    } else if (args[0] === "off") { // Disable New Restrict (/newrestrict off).
                        settings.active = false;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`New Restrict is now Off.`
                        );
                    } else if (args[0] === "mute") { // Change muting time (/newrestrict mute <integer bigger or equal to 300>).
                        if (parseInt(args[1]) >= 300) {
                            settings.mutingTime = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`New Restrict muting time is now ${settings.mutingTime}.`
                            );
                        } else if (parseInt(args[1]) < 300) {
                            ctx.replyWithHTML(
                                html`New Restrict muting time cannot be lower than 300 seconds (5 minutes).`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`New Restrict muting time value is invalid.`
                            );
                        }
                    } else if (args[0] === "settings") { // Print plugin settings (/newrestrict settings).
                        ctx.replyWithHTML(
                            html`New Restrict settings:
                            <code>
                            active: ${settings.active}
                            mutingTime: ${settings.mutingTime}
                            </code>`
                        );
                    } else { // Invalid arguments, show New Restrict commands.
                        ctx.replyWithHTML(
                            html`New Restrict usage:
                            <code>/newrestrict argument value</code>\n
                            New Restrict arguments:\n
                            <code>on</code> - Enables New Restrict.
                            <code>off</code> - Disables New Restrict.
                            <code>mute</code> - Changes the muting time, in seconds, cannot be lower than 300 seconds (5 minutes).
                            <code>settings</code> - Shows the current settings for New Restrict.`
                        );
                    }
                }
            }
            ctx.deleteMessage(ctx.message?.message_id);
        }
    }

    let inList = false;

    restrictList.forEach((s) => { if (s.user.id === ctx.from?.id && s.chat === String(ctx.chat?.id)) { inList = true } })

    //logError("[newrestrict] New Message from Member in List: " + inList);

    if (settings.active && !ctx.from?.is_bot && !inList && (adminList.indexOf(ctx.from?.id) < 0)) {
        const s = restricting(ctx, ctx.from);
        restrictList.push(s);
        s.chat = String(ctx.chat?.id);
    }

    //logError("[newrestrict] Slow List: " + restrictList.length);

    const currentMessage = restrictList.find(
        (x) => (x.user.id === ctx.from?.id && x.chat === String(ctx.chat?.id))
    );

    if (!currentMessage) {
        return next();
    }

    //logError("[newrestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " Message Counter: " + currentMessage.messageCounter);

    let msg;
    const currentOptions = {
        until_date: Math.floor((Date.now() / 1000) + settings.mutingTime),
        can_send_messages: mutedOptions.can_send_messages,
        can_send_media_messages: mutedOptions.can_send_media_messages,
        can_send_polls: mutedOptions.can_send_polls,
        can_send_other_messages: mutedOptions.can_send_other_messages,
        can_add_web_page_previews: mutedOptions.can_add_web_page_previews,
        can_change_info: mutedOptions.can_change_info,
        can_invite_users: mutedOptions.can_invite_users,
        can_pin_messages: mutedOptions.can_pin_messages
    }
    return Promise.all([
        ctx.replyWithHTML(html`${link(ctx.from)} is posting too many messages too fast, they have been muted for ${(settings.mutingTime / 60)} minutes`),
        ctx.telegram.restrictChatMember(ctx.chat?.id, ctx.from?.id, currentOptions),
    ]).catch((err) => logError("[newrestrict] " + err.message));
});