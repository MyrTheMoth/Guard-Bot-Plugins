import type { ExtendedContext } from "../typings/context";
import type { UserProfilePhotos, Chat } from "telegraf/typings/telegram-types";
import Telegraf = require("telegraf");
import HtmlUtils = require("../utils/html");
import TgUtils = require("../utils/tg");
import Log = require("../utils/log");
import UserStore = require('../stores/user');
import Files = require('fs');

let settings = {
    active: true, // If True, module is active and will kick profiles depending on the criteria you setup.
    kickCooldown: 300, // Time before a kicked user can attempt to join the chat again in 5 minutes (300 seconds) by default.
    checkUsername: true, // If True, checks if the new member has an username, if they don't, they'll fail this check.
    checkPicture: true, // If True, checks if the new member has a profile picture, if they don't, they'll fail this check.
    checkBio: true, // If True, checks if the new member has a bio description, if they don't, they'll fail this check.
    feedback: true, // If True, it will post a message detailing why the user was removed.
    tolerance: 2 // Value from 1 to 3, determines how many checks the new member must fail to be kicked.
}

const { Composer: C } = Telegraf;
const { html } = HtmlUtils;
const { link } = TgUtils;
const { logError } = Log;
const { getAdmins } = UserStore;
const fs = Files;

type seenOnce = {
    user: number;
    chat: String;
};

const userSeen = (u: number, c: String): seenOnce => {
    const s = {
        user: u,
        chat: c
    };
    return s;
}

const kickedOnce: seenOnce[] = [];

const adminList: number[] = [];

const settingsFile = "./plugins/noinfokick.json";

// If a settings file exists, read it and update our settings with it.
fs.access(settingsFile, fs.F_OK, (err) => {
    if (err) {
        logError("[noinfokick] " + err.message);
        updateSettings();
        logError("[slowmode] Creating new settings file.");
        return;
    }
    fs.readFile(settingsFile, "utf-8", (err, data) => {
        if (err) {
            logError("[noinfokick] " + err.message);
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
            logError("[noinfokick] " + err.message);
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

        // Command arguments (/noinfokick).
        if (command === "noinfokick") {
            if (adminList.indexOf(ctx.from?.id) >= 0) {
                if (args !== null) {
                    if (args[0] === "on") { // Enable No Info Kick (/noinfokick on).
                        settings.active = true;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`No Info Kick is now On.`
                        );
                    } else if (args[0] === "off") { // Disable No Info Kick (/noinfokick off).
                        settings.active = false;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`No Info Kick is now Off.`
                        );
                    } else if (args[0] === "cooldown") { // Change kick cooldown. (/noinfokick cooldown <integer bigger or equal to 300>).
                        if (parseInt(args[1]) >= 300) {
                            settings.kickCooldown = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`No Info Kick cooldown kick time is now ${settings.kickCooldown}.`
                            );
                        } else if (parseInt(args[1]) < 300) {
                            ctx.replyWithHTML(
                                html`No Info Kick cooldown kick time cannot be lower than 300 seconds (5 minutes).`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`No Info Kick cooldown kick time value is invalid.`
                            );
                        }
                    } else if (args[0] === "username") { // Change No Info Kick username (/noinfokick username <true or false>).
                        if (args[1] == "true") {
                            settings.checkUsername = true;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`No Info Kick username checking is enabled.`
                            );
                        } else if (args[1] == "false") {
                            settings.checkUsername = false;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`No Info Kick username checking is disabled.`
                            );
                        }
                    } else if (args[0] === "picture") { // Change No Info Kick picture (/noinfokick picture <true or false>).
                        if (args[1] == "true") {
                            settings.checkPicture = true;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`No Info Kick picture checking is enabled.`
                            );
                        } else if (args[1] == "false") {
                            settings.checkPicture = false;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`No Info Kick picture checking is disabled.`
                            );
                        }
                    } else if (args[0] === "bio") { // Change No Info Kick bio (/noinfokick bio <true or false>).
                        if (args[1] == "true") {
                            settings.checkBio = true;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`No Info Kick bio checking is enabled.`
                            );
                        } else if (args[1] == "false") {
                            settings.checkBio = false;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`No Info Kick bio checking is disabled.`
                            );
                        }
                    } else if (args[0] === "feedback") { // Change No Info Kick feedback (/noinfokick feedback <true or false>).
                        if (args[1] == "true") {
                            settings.feedback = true;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`No Info Kick feedback is enabled.`
                            );
                        } else if (args[1] == "false") {
                            settings.feedback = false;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`No Info Kick feedback is disabled.`
                            );
                        }
                    } else if (args[0] === "tolerance") { // Change No Info Kick tolerance (/noinfokick tolerance <1, 2 or 3>).
                        if (parseInt(args[1]) >= 1 && parseInt(args[1]) <= 3) {
                            settings.tolerance = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`No Info Kick tolerance is now ${settings.tolerance}.`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`No Info Kick tolerance can only be 1, 2 or 3.`
                            );
                        }
                    } else if (args[0] === "settings") { // Print plugin settings (/noinfokick settings).
                        ctx.replyWithHTML(
                            html`No Info Kick settings:
                            <code>
                            active: ${settings.active}
                            kickCooldown: ${settings.kickCooldown}
                            checkUsername: ${settings.checkUsername}
                            checkPicture: ${settings.checkPicture}
                            checkBio: ${settings.checkBio}
                            feedback: ${settings.feedback}
                            tolerance: ${settings.tolerance}
                            </code>`
                        );
                    } else { // Invalid arguments, show No Info Kick commands.
                        ctx.replyWithHTML(
                            html`No Info Kick usage:
                            <code>/noinfokick argument value</code>\n
                            No Info Kick arguments:\n
                            <code>on</code> - Enables No Info Kick.
                            <code>off</code> - Disables No Info Kick.
                            <code>cooldown</code> - Changes the kick cooldown, in seconds, cannot be lower than 300 seconds (5 minutes).
                            <code>username</code> - Switches username checking on and off, boolean, only accepts true or false.
                            <code>picture</code> - Switches picture checking on and off, boolean, only accepts true or false.
                            <code>bio</code> - Switches bio checking on and off, boolean, only accepts true or false.
                            <code>feedback</code> - Switches feedback messages on and off, boolean, only accepts true or false.
                            <code>tolerance</code> - Changes the tolerance for failure, a number from 1 to 3.
                            <code>settings</code> - Shows the current settings for No Info Kick.`
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
            let username = false;
            let picture = false;
            let bio = false;
            let kickMessage = "";
            let profilePictures: UserProfilePhotos;
            let userBio: Chat;
            let fails = 0;
            let seen = userSeen(x.id, String(ctx.chat?.id));
            let neverSeen = true;
            let seenIndex = -1;

            for (var i = 0; i < kickedOnce.length; i++) {
                if (kickedOnce[i].user === x.id && kickedOnce[i].chat === String(ctx.chat?.id)) {
                    neverSeen = false;
                    seenIndex = i;
                }
            }

            //logError("[noinfokick] New Member: [" + x.id + "] (" + x.username + ") {" + x.first_name + " " + x.last_name + "}\n");
            if (settings.checkUsername) {
                //logError("[noinfokick] Username: " + x.username + "\n");
                if (x.username == null) {
                    username = true;
                    kickMessage = kickMessage + "No Username \n";
                    fails = fails + 1;
                }
            }
            if (settings.checkPicture) {
                profilePictures = await ctx.telegram.getUserProfilePhotos(x.id);
                //logError("[noinfokick] Profile Picture Count: " + profilePictures.total_count + "\n");
                if (profilePictures.total_count === 0) {
                    picture = true;
                    kickMessage = kickMessage + "No Profile Picture \n";
                    fails = fails + 1;
                }
            }
            if (settings.checkBio) {
                userBio = await ctx.telegram.getChat(x.id);
                //logError("[noinfokick] Bio: " + userBio.bio + "\n");
                if (userBio.bio == null) {
                    bio = true;
                    kickMessage = kickMessage + "No Bio \n";
                    fails = fails + 1;
                }
            }
            if ((settings.active) && (fails >= settings.tolerance) && neverSeen && (!x.is_bot)) {
                if (settings.feedback) {
                    ctx.replyWithHTML(html`User ${link(x)} has been kicked under suspicion of being an userbot. \n\n
                        If they aren't an userbot, they may attempt to rejoin in 5 minutes.`);
                    // ctx.replyWithHTML(
                    //     html`User ${link(x)} has been kicked as suspicious for: \n
                    // <code>${kickMessage}</code>`
                    // );
                }
                ctx.kickChatMember(x.id, Math.floor((Date.now() / 1000) + settings.kickCooldown));
                kickedOnce.push(seen);
            } else {
                if (!neverSeen) {
                    kickedOnce.splice(seenIndex, 1);
                }
                return next();
            }
        })
    ).catch((err) => logError("[noinfokick] " + err.message));
});