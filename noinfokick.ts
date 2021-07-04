import type { ExtendedContext } from "../typings/context";
import type { UserProfilePhotos, Chat } from "telegraf/typings/telegram-types";
import Telegraf = require("telegraf");
import HtmlUtils = require("../utils/html");
import TgUtils = require("../utils/tg");
import Log = require("../utils/log");

let active = true; // If True, module is active and will kick profiles depending on the criteria you setup.
const kickCooldown = 300; // Time before a kicked user can attempt to join the chat again in 5 minutes (300 seconds) by default.
const checkUsername = true; // If True, checks if the new member has an username, if they don't, they'll fail this check.
const checkPicture = true; // If True, checks if the new member has a profile picture, if they don't, they'll fail this check.
const checkBio = true; // If True, checks if the new member has a bio description, if they don't, they'll fail this check.
const feedback = true; // If True, it will post a message detailing why the user was removed.
const tolerance = 2; // Value from 1 to 3, determines how many checks the new member must fail to be kicked.

const { Composer: C } = Telegraf;
const { html } = HtmlUtils;
const { link } = TgUtils;
const { logError } = Log;

const kickedOnce: number[] = [];

export = C.mount("message", async (ctx: ExtendedContext, next) => {
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

        if (command === "noinfokick") {
            const member = await ctx.getChatMember(ctx.from?.id);
            if (member && (member.status === 'creator' || member.status === 'administrator')) {
                if (args !== null) {
                    if (args[0] === "on") {
                        active = true;
                        ctx.replyWithHTML(
                            html`Userbot checking is now On.`
                        );
                    } else if (args[0] === "off") {
                        active = false;
                        ctx.replyWithHTML(
                            html`Userbot checking is now Off.`
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
            //logError("[noinfokick] New Member: [" + x.id + "] (" + x.username + ") {" + x.first_name + " " + x.last_name + "}\n");
            if (checkUsername) {
                //logError("[noinfokick] Username: " + x.username + "\n");
                if (x.username == null) {
                    username = true;
                    kickMessage = kickMessage + "No Username \n";
                    fails = fails + 1;
                }
            }
            if (checkPicture) {
                profilePictures = await ctx.telegram.getUserProfilePhotos(x.id);
                //logError("[noinfokick] Profile Picture Count: " + profilePictures.total_count + "\n");
                if (profilePictures.total_count === 0) {
                    picture = true;
                    kickMessage = kickMessage + "No Profile Picture \n";
                    fails = fails + 1;
                }
            }
            if (checkBio) {
                userBio = await ctx.telegram.getChat(x.id);
                //logError("[noinfokick] Bio: " + userBio.bio + "\n");
                if (userBio.bio == null) {
                    bio = true;
                    kickMessage = kickMessage + "No Bio \n";
                    fails = fails + 1;
                }
            }
            if ((active) && (fails >= tolerance) && (kickedOnce.indexOf(x.id) < 0) && (!x.is_bot)) {
                if (feedback) {
                    ctx.replyWithHTML(html`User ${link(x)} has been kicked under suspicion of being an userbot. \n\n
                        If they aren't an userbot, they may attempt to rejoin in 5 minutes.`);
                    // ctx.replyWithHTML(
                    //     html`User ${link(x)} has been kicked as suspicious for: \n
                    // <code>${kickMessage}</code>`
                    // );
                }
                ctx.kickChatMember(x.id, Math.floor((Date.now() / 1000) + kickCooldown));
                kickedOnce.push(x.id);
            } else {
                if (kickedOnce.indexOf(x.id) >= 0) {
                    kickedOnce.splice(kickedOnce.indexOf(x.id), 1);
                }
                return next();
            }
        })
    ).catch((err) => logError("[noinfokick] " + err.message));
});