import type { ExtendedContext } from "../typings/context";
import type { User } from "telegraf/typings/telegram-types";
import Telegraf = require("telegraf");
import HtmlUtils = require("../utils/html");
import TgUtils = require("../utils/tg");
import Log = require("../utils/log");
import UserStore = require('../stores/user');
import Files = require('fs');
import captchagen = require('captchagen');

let settings = {
    active: true, // If True, Bot will issue Captcha Challenges for new Members.
    challengeTimeout: 1800, // Time before Bot kicks the user for not answer, 30 minutes (1800 seconds) by default.
    kickCooldown: 300, // Time before a kicked user can attempt to join the chat again in 5 minutes (300 seconds) by default.
    strict: true, // If True, deletes all messages by unverified users that aren't answers.
    maxAttempts: 3, // Max number of attempts before kicking the unverified user.
    maxRegens: 3, // Max number of captcha re-generations that the user may request.
    exclude: [] // List of chats to exclude from this plugin's actions.
}

// Permissions for the new user when they join the chat.
const unverifiedOptions = {
    can_send_messages: true,
    can_send_media_messages: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false
}

// Permissions for the new user after they Complete the Captcha. Check 
const verifiedOptions = {
    can_send_messages: true,
    can_send_media_messages: true,
    can_send_polls: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
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

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

type Challenge = {
    user: User;
    chat: string;
    kickTimeout: number;
    text: string;
    image: string;
    messageId: number;
    deleteList: number[];
    attempts: number;
    regens: number;
};

const challenge = (
    challenges: Challenge[],
    ctx: ExtendedContext,
    x: User,
): Challenge => {
    var imageCaptcha = captchagen.create();
    imageCaptcha.generate();
    const c = {
        user: x,
        chat: "",
        kickTimeout: (setTimeout(() => {
            ctx
                .kickChatMember(x.id, Math.floor((Date.now() / 1000) + settings.kickCooldown))
                .catch((err) => logError("[captcha] " + err.message))
                .then(() => {
                    challenges.splice(challenges.indexOf(c), 1);
                    return ctx.deleteMessage(c.messageId);
                })
                .catch((err) => logError("[captcha] " + err.message));
        }, settings.challengeTimeout * 1000) as unknown) as number,
        text: imageCaptcha.text(),
        image: imageCaptcha.buffer(),
        messageId: 0,
        deleteList: [],
        attempts: settings.maxAttempts,
        regens: settings.maxRegens,
    };
    return c;
};

const activeChallenges: Challenge[] = [];

const adminList: number[] = [];

const settingsFile = "./plugins/captcha.json";

// If a settings file exists, read it and update our settings with it.
fs.access(settingsFile, fs.F_OK, (err) => {
    if (err) {
        logError("[captcha] " + err.message);
        updateSettings();
        logError("[captcha] Creating new settings file.");
        return;
    }
    fs.readFile(settingsFile, "utf-8", (err, data) => {
        if (err) {
            logError("[captcha] " + err.message);
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
            logError("[captcha] " + err.message);
            return;
        }
    });
}

function updateExclusion(e) {
    if (settings.exclude.indexOf(e) < 0) {
        settings.exclude.push(e);
        return 0;
    } else {
        settings.exclude.splice(settings.exclude.indexOf(e), 1);
        return 1;
    }
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

        // Command arguments (/captcha).
        if (command === "captcha") {
            if (adminList.indexOf(ctx.from?.id) >= 0) {
                if (args !== null) {
                    if (args[0] === "on") { // Enable Captcha (/captcha on).
                        settings.active = true;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`Captcha is now On.`
                        );
                    } else if (args[0] === "off") { // Disable Captcha (/captcha off).
                        settings.active = false;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`Captcha is now Off.`
                        );
                    } else if (args[0] === "timeout") { // Change challenge timeout. (/captcha timeout <integer bigger or equal to 300>).
                        if (parseInt(args[1]) >= 300) {
                            settings.challengeTimeout = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Captcha cooldown kick time is now ${settings.challengeTimeout}.`
                            );
                        } else if (parseInt(args[1]) < 300) {
                            ctx.replyWithHTML(
                                html`Captcha cooldown kick time cannot be lower than 300 seconds (5 minutes).`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`Captcha cooldown kick time value is invalid.`
                            );
                        }
                    } else if (args[0] === "cooldown") { // Change kick cooldown. (/captcha cooldown <integer bigger or equal to 300>).
                        if (parseInt(args[1]) >= 300) {
                            settings.kickCooldown = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Captcha cooldown kick time is now ${settings.kickCooldown}.`
                            );
                        } else if (parseInt(args[1]) < 300) {
                            ctx.replyWithHTML(
                                html`Captcha cooldown kick time cannot be lower than 300 seconds (5 minutes).`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`Captcha cooldown kick time value is invalid.`
                            );
                        }
                    } else if (args[0] === "strict") { // Change Captcha strict (/captcha strict <true or false>).
                        if (args[1] == "true") {
                            settings.strict = true;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Captcha strict is enabled.`
                            );
                        } else if (args[1] == "false") {
                            settings.strict = false;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Captcha strict is disabled.`
                            );
                        }
                    } else if (args[0] === "attempts") { // Change max attempts (/captcha attempts <integer bigger or equal to 1>).
                        if (parseInt(args[1]) >= 1) {
                            settings.maxAttempts = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Captcha max attempts is now ${settings.maxAttempts}.`
                            );
                        } else if (parseInt(args[1]) < 1) {
                            ctx.replyWithHTML(
                                html`Captcha max attempts cannot be lower than 1 attempt.`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`Captcha max attempts value is invalid.`
                            );
                        }
                    } else if (args[0] === "regens") { // Change max regens (/captcha regen <integer bigger or equal to 1>).
                        if (parseInt(args[1]) >= 1) {
                            settings.maxRegens = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Captcha max regens is now ${settings.maxAttempts}.`
                            );
                        } else if (parseInt(args[1]) < 1) {
                            ctx.replyWithHTML(
                                html`Captcha max regens cannot be lower than 1 attempt.`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`Captcha max regens value is invalid.`
                            );
                        }
                    } else if (args[0] === "exclude") { // Changes if the plugin will work on this chat or not (/captcha exclude).
                        let exclusionResult = updateExclusion(String(ctx.chat?.id));
                        updateSettings();
                        if (exclusionResult === 0) {
                            ctx.replyWithHTML(
                                html`Captcha will stop working in this chat.`
                            );
                        } else if (exclusionResult === 1) {
                            ctx.replyWithHTML(
                                html`Captcha will resume working in this chat.`
                            );
                        }
                    } else if (args[0] === "settings") { // Print plugin settings (/captcha settings).
                        ctx.replyWithHTML(
                            html`Captcha settings:
                            <code>
                            active: ${settings.active}
                            challengeTimeout: ${settings.challengeTimeout}
                            kickCooldown: ${settings.kickCooldown}
                            strict: ${settings.strict}
                            maxAttempts: ${settings.maxAttempts}
                            maxRegens: ${settings.maxRegens}
                            exclude: ${settings.exclude}
                            </code>`
                        );
                    } else { // Invalid arguments, show Captcha commands.
                        ctx.replyWithHTML(
                            html`Captcha usage:
                            <code>/captcha argument value</code>\n
                            Captcha arguments:\n
                            <code>on</code> - Enables Captcha.
                            <code>off</code> - Disables Captcha.
                            <code>timeout</code> - Changes the challenge timeout, in seconds, cannot be lower than 300 seconds (5 minutes).
                            <code>cooldown</code> - Changes the kick cooldown, in seconds, cannot be lower than 300 seconds (5 minutes).
                            <code>strict</code> - Switches message deletion on challenge ending on and off, boolean, only accepts true or false.
                            <code>attempts</code> - Changes the max number of attempts, cannot be lower than 1.
                            <code>regens</code> - Changes the max number of regens, cannot be lower than 1.
                            <code>exclude</code> - Changes if the plugin will work on this chat or not.
                            <code>settings</code> - Shows the current settings for Captcha.`
                        );
                    }
                }
            }
            ctx.deleteMessage(ctx.message?.message_id);
        }
    }

    if (settings.active && settings.exclude.indexOf(String(ctx.chat?.id)) < 0) {

        const members = ctx.message?.new_chat_members?.filter(
            (x) => x.username !== ctx.me
        );
        const memberLeft = ctx.message?.left_chat_member;
        if (!members || members.length === 0) {
            const foundChallenge = activeChallenges.find(
                (x) => (x.user.id === ctx.from?.id && x.chat === String(ctx.chat?.id))
            );
            if (!foundChallenge) {
                return next();
            }
            if (memberLeft) {
                if (memberLeft.id === foundChallenge.user.id) {
                    clearTimeout(foundChallenge.kickTimeout);
                    activeChallenges.splice(activeChallenges.indexOf(foundChallenge), 1);
                    return Promise.all([
                        ctx.message?.message_id
                            ? ctx.deleteMessage(ctx.message?.message_id)
                            : Promise.resolve(true),
                        ctx.deleteMessage(foundChallenge.messageId),
                        foundChallenge.deleteList.forEach(number => {
                            ctx.deleteMessage(number);
                        }),
                    ]).catch((err) => logError("[captcha] " + err.message));
                }
            }
            if (String(ctx.message?.text).toLowerCase() === foundChallenge.text) {
                //logError("Correct Answer: \n" + ctx.message?.text + " " + foundChallenge.math[1] + "\n" + ctx.chat?.id + " " + foundChallenge.chat);
                clearTimeout(foundChallenge.kickTimeout);
                activeChallenges.splice(activeChallenges.indexOf(foundChallenge), 1);
                return Promise.all([
                    ctx.message?.message_id
                        ? ctx.deleteMessage(ctx.message?.message_id)
                        : Promise.resolve(true),
                    ctx.deleteMessage(foundChallenge.messageId),
                    foundChallenge.deleteList.forEach(number => {
                        ctx.deleteMessage(number);
                    }),
                    ctx.replyWithHTML(html`Thank you, ${link(ctx.from)}, please read the rules in our pinned message and enjoy the chat!`),
                    ctx.telegram.restrictChatMember(ctx.chat?.id, ctx.from?.id, verifiedOptions),
                ]).catch((err) => logError("[captcha] " + err.message));
            }
            if (String(ctx.message?.text).toLowerCase() !== foundChallenge.text) {
                //logError("Wrong Answer: \n" + ctx.message?.text + " " + foundChallenge.math[1] + "\n" + ctx.chat?.id + " " + foundChallenge.chat);
                if (String(ctx.message?.text).toLowerCase() === "new" && foundChallenge.regens > 0) {
                    var imageCaptcha = captchagen.create();
                    imageCaptcha.generate();
                    let captionMessage;
                    foundChallenge.regens = foundChallenge.regens - 1;
                    if (foundChallenge.regens > 1) {
                        captionMessage = `Here is your new Captcha, <a href="tg://user?id=${ctx.from?.id}">${ctx.from?.first_name}</a> [<code>${ctx.from?.id}</code>], you may attempt to generate a new one ${foundChallenge.regens} more times.`;
                    } else if (foundChallenge.regens === 1) {
                        captionMessage = `Here is your new Captcha, <a href="tg://user?id=${ctx.from?.id}">${ctx.from?.first_name}</a> [<code>${ctx.from?.id}</code>], you may attempt to generate a new one ${foundChallenge.regens} more time.`;
                    } else {
                        captionMessage = `Here is your new Captcha, <a href="tg://user?id=${ctx.from?.id}">${ctx.from?.first_name}</a> [<code>${ctx.from?.id}</code>], this is your last one.`;
                    }
                    let msg;
                    return Promise.all([
                        foundChallenge.text = imageCaptcha.text(),
                        foundChallenge.image = imageCaptcha.buffer(),
                        foundChallenge.deleteList.push(ctx.message?.message_id),
                        msg = await ctx.replyWithPhoto(
                            { source: foundChallenge.image },
                            {
                                caption: captionMessage,
                                parse_mode: "HTML"
                            }),
                        foundChallenge.deleteList.push(msg?.message_id),
                    ]).catch((err) => logError("[captcha] " + err.message));
                } else {
                    if (foundChallenge.attempts >= 1) {
                        let msg;
                        let replyMessage;
                        foundChallenge.attempts = foundChallenge.attempts - 1;
                        if (foundChallenge.attempts > 1) {
                            replyMessage = html`Sorry, ${link(ctx.from)}, that answer is incorrect, you have ${foundChallenge.attempts} attempts left, try again!`;
                        } else if (foundChallenge.attempts === 1) {
                            replyMessage = html`Sorry, ${link(ctx.from)}, that answer is incorrect, you have ${foundChallenge.attempts} attempt left, try again!`;
                        } else {
                            replyMessage = html`Sorry, ${link(ctx.from)}, that answer is incorrect, this is your last attempt, try again!`;
                        }
                        return Promise.all([
                            foundChallenge.deleteList.push(ctx.message?.message_id),
                            msg = await ctx.replyWithHTML(replyMessage),
                            foundChallenge.deleteList.push(msg?.message_id),
                        ]).catch((err) => logError("[captcha] " + err.message));
                    } else {
                        clearTimeout(foundChallenge.kickTimeout);
                        activeChallenges.splice(activeChallenges.indexOf(foundChallenge), 1);
                        return Promise.all([
                            ctx.message?.message_id
                                ? ctx.deleteMessage(ctx.message?.message_id)
                                : Promise.resolve(true),
                            ctx.deleteMessage(foundChallenge.messageId),
                            foundChallenge.deleteList.forEach(number => {
                                ctx.deleteMessage(number);
                            }),
                            ctx.kickChatMember(ctx.from?.id, Math.floor((Date.now() / 1000) + settings.kickCooldown)),
                        ]).catch((err) => logError("[captcha] " + err.message));
                    }
                }
            }
            return settings.strict
                ? ctx.message?.message_id
                    ? ctx.deleteMessage(ctx.message?.message_id)
                    : Promise.resolve(true)
                : next();
        }

        return Promise.all(
            members.map(async (x) => {
                if (!x.is_bot) {
                    const c = challenge(activeChallenges, ctx, x);
                    activeChallenges.push(c);
                    let captionMessage = `Welcome <a href="tg://user?id=${x.id}">${x.first_name}</a> [<code>${x.id}</code>], please solve the following captcha in ${(settings.challengeTimeout / 60)} minutes.\n\nif you can't solve this one and need a new captcha, you may generate a new one by saying \"<code>new</code>\"`
                    const msg = await ctx.replyWithPhoto(
                        { source: c.image },
                        {
                            caption: captionMessage,
                            parse_mode: "HTML"
                        });
                    c.chat = String(ctx.chat?.id);
                    c.messageId = msg.message_id;
                    ctx.telegram.restrictChatMember(ctx.chat?.id, ctx.from?.id, unverifiedOptions);
                }
            })
        );
    } else {
        return next();
    }
});