import type { ExtendedContext } from "../typings/context";
import type { User } from "telegraf/typings/telegram-types";
import Telegraf = require("telegraf");
import HtmlUtils = require("../utils/html");
import TgUtils = require("../utils/tg");
import Log = require("../utils/log");

let active = true; // If True, Bot will mute users who post too many messages too quickly.
const mutingTime = 300; // Time a slowed user will be muted for in seconds, 5 minutes (300 seconds) by default.
const minutes = mutingTime / 60;
const postingInterval = 1 // Time between messages to count as a penalty in seconds, 1 by default.
const maxMessages = 10; // Max amount of messages allowed within the posting interval, 10 by default.

// Permissions for muted user.
const mutedOptions = {
    can_send_messages: false,
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

type Slow = {
    user: User;
    chat: string;
    muteTimeout: number;
    messageCounter: number;
    lastMessageDate: Date;
};

const slowing = (
    slowening: Slow[],
    ctx: ExtendedContext,
    x: User,
): Slow => {
    const s = {
        user: x,
        chat: "",
        muteTimeout: mutingTime,
        messageCounter: 0,
        lastMessageDate: new Date(),
    };
    return s;
};

const slowList: Slow[] = [];

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

        if (command === "slowmode") {
            const member = await ctx.getChatMember(ctx.from?.id);
            if (member && (member.status === 'creator' || member.status === 'administrator')) {
                if (args !== null) {
                    if (args[0] === "on") {
                        active = true;
                        ctx.replyWithHTML(
                            html`Slow Mode is now On.`
                        );
                    } else if (args[0] === "off") {
                        active = false;
                        ctx.replyWithHTML(
                            html`Slow Mode is now Off.`
                        );
                    }
                }
            }
            ctx.deleteMessage(ctx.message?.message_id);
        }
    }

    var inList = false;

    slowList.forEach((s) => { if (s.user.id === ctx.from?.id && s.chat === String(ctx.chat?.id)) { inList = true } })

    //logError("[slowmode] New Message from Member in List: " + inList);

    if (active && !ctx.from?.is_bot && !inList) {
        const s = slowing(slowList, ctx, ctx.from);
        slowList.push(s);
        s.chat = String(ctx.chat?.id);
    }

    //logError("[slowmode] Slow List: " + slowList.length);

    const currentMessage = slowList.find(
        (x) => (x.user.id === ctx.from?.id && x.chat === String(ctx.chat?.id))
    );

    if (!currentMessage) {
        return next();
    }

    //logError("[slowmode] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " Previous Message Time: " + currentMessage.lastMessageDate.getTime());
    const newMessageDate = new Date();
    //logError("[slowmode] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " New Message Time: " + newMessageDate.getTime());
    const messageTimeDifference = newMessageDate.getTime() - currentMessage.lastMessageDate.getTime();
    currentMessage.lastMessageDate = newMessageDate;

    //logError("[slowmode] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " Time Difference: " + messageTimeDifference);

    if (messageTimeDifference <= (postingInterval * 1000)) {
        currentMessage.messageCounter = currentMessage.messageCounter + 1;
    } else if (messageTimeDifference > (postingInterval * 1000)) {
        if (currentMessage.messageCounter > 0) {
            currentMessage.messageCounter = currentMessage.messageCounter - 1;
        }
    }

    //logError("[slowmode] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " Message Counter: " + currentMessage.messageCounter);

    if (currentMessage.messageCounter >= maxMessages) {
        let msg;
        const currentOptions = {
            until_date: Math.floor((Date.now() / 1000) + mutingTime),
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
            msg = await ctx.replyWithHTML(html`${link(ctx.from)} is posting too many messages too fast, they have been muted for ${minutes} minutes`),
            ctx.telegram.restrictChatMember(ctx.chat?.id, ctx.from?.id, currentOptions),
            currentMessage.messageCounter = 0,
        ]).catch((err) => logError("[slowmode] " + err.message));
    }

    return next();
});