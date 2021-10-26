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
    feedback: true, // Post a message if an user is restricted, true by default.
    mutingTime: 86400, // Time a slowed user will be muted for in seconds, 24 hours (86400 seconds) by default.
    firstMedia: true, // Restrict immediately if first message recorded by the plug-in is some type of media, true by default.
    restrictScore: 5, // Maximum amount of score an user is allowed to accumulate before being restricted, 5 by default.
    maxMedia: 1, // Amount of media messages needed to increase an user's media posting score, 1 by default.
    maxMessages: 1, // Amount of non-media messages needed to decrease the user's media posting score, 1 by default.
    checkUsername: false, // Check if @Username mentions count towards a media posting score, false by default.
    checkHashtag: false, // Check if #Hashtags count towards a media posting score, false by default.
    checkURL: true, // Check if URLs (http(s)://www.example.com) count towards a media posting score, true by default.
    checkEmail: true, // Check if Emails (mail@example.com) count towards a media posting score, true by default.
    checkPhone: true, // Check if Phone Numbers (+5 555-5555555) count towards a media posting score, true by default.
    checkAnimation: true, // Check if GIFs count towards a media posting score, true by default.
    checkAudio: true, // Check if Audio counts towards a media posting score, true by default.
    checkDocument: true, // Check if Documents count towards a media posting score, true by default.
    checkPhoto: true, // Check if Photos count towards a media posting score, true by default.
    checkSticker: true, // Check if Stickers count towards a media posting score, true by default.
    checkVideo: true, // Check if Videos count towards a media posting score, true by default.
    checkVideoNote: true, // Check if Video Notes count towards a media posting score, true by default.
    checkVoice: true, // Check if Voice Messages count towards a media posting score, true by default.
    checkContact: true, // Check if sharing Contacts count towards a media posting score, true by default.
    checkDice: true, // Check if Dice messages count towards a media posting score, true by default.
    checkGame: true, // Check if Games count towards a media posting score, true by default.
    checkPoll: true, // Check if Polls count towards a media posting score, true by default.
    checkVenue: true, // Check if Venues count towards a media posting score, true by default.
    checkLocation: true // Check if Location count towards a media posting score, true by default.
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
    mediaCounter: number;
    messageCounter: number;
    postingScore: number;
    firstMediaPost: boolean;
};

const restricting = (
    ctx: ExtendedContext,
    x: User,
): Restricted => {
    const s = {
        user: x,
        chat: "",
        mediaCounter: 0,
        messageCounter: 0,
        postingScore: 0,
        firstMediaPost: true,
    };
    return s;
};

const restrictList: Restricted[] = [];

const adminList: number[] = [];

const settingsFile = "./plugins/mediarestrict.json";

// If a settings file exists, read it and update our settings with it.
fs.access(settingsFile, fs.F_OK, (err) => {
    if (err) {
        logError("[mediarestrict] " + err.message);
        updateSettings();
        logError("[mediarestrict] Creating new settings file.");
        return;
    }
    fs.readFile(settingsFile, "utf-8", (err, data) => {
        if (err) {
            logError("[mediarestrict] " + err.message);
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
            logError("[mediarestrict] " + err.message);
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

        // Command arguments (/mediarestrict).
        if (command === "mediarestrict") {
            if (adminList.indexOf(ctx.from?.id) >= 0) {
                if (args !== null) {
                    if (args[0] === "on") { // Enable Media Restrict (/mediarestrict on).
                        settings.active = true;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`Media Restrict is now On.`
                        );
                    } else if (args[0] === "off") { // Disable Media Restrict (/mediarestrict off).
                        settings.active = false;
                        updateSettings();
                        ctx.replyWithHTML(
                            html`Media Restrict is now Off.`
                        );
                    } else if (args[0] === "feedback") { // Provide feedback when an user is restricted. (/mediarestrict feedback).
                        if (settings.feedback) {
                            settings.feedback = false;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Media Restrict will stop providing feedback.`
                            );
                        } else {
                            settings.feedback = true;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Media Restrict will start providing feedback.`
                            );
                        }
                    } else if (args[0] === "mute") { // Change muting time (/mediarestrict mute <integer bigger or equal to 300>).
                        if (parseInt(args[1]) >= 300) {
                            settings.mutingTime = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Media Restrict muting time is now ${settings.mutingTime}.`
                            );
                        } else if (parseInt(args[1]) < 300) {
                            ctx.replyWithHTML(
                                html`Media Restrict muting time cannot be lower than 300 seconds (5 minutes).`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`Media Restrict muting time value is invalid.`
                            );
                        }
                    } else if (args[0] === "first") { // Change whether to restrict users if their first seen post is media. (/mediarestrict first).
                        if (settings.firstMedia) {
                            settings.firstMedia = false;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Media Restrict will not restrict users if their first seen message is media.`
                            );
                        } else {
                            settings.firstMedia = true;
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Media Restrict will restrict users if their first seen message is media.`
                            );
                        }
                    } else if (args[0] === "score") { // Change max score before restricting an user (/mediarestrict score <integer bigger or equal to 1>).
                        if (parseInt(args[1]) >= 1) {
                            settings.restrictScore = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Media Restrict max score is now ${settings.restrictScore}.`
                            );
                        } else if (parseInt(args[1]) < 1) {
                            ctx.replyWithHTML(
                                html`Media Restrict max score cannot be lower than 1.`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`Media Restrict max score value is invalid.`
                            );
                        }
                    } else if (args[0] === "media") { // Change max media threshold to increase the score (/mediarestrict media <integer bigger or equal to 1>).
                        if (parseInt(args[1]) >= 1) {
                            settings.maxMedia = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Media Restrict max media is now ${settings.maxMedia}.`
                            );
                        } else if (parseInt(args[1]) < 1) {
                            ctx.replyWithHTML(
                                html`Media Restrict max media cannot be lower than 1.`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`Media Restrict max media value is invalid.`
                            );
                        }
                    } else if (args[0] === "messages") { // Change max message threshold to decrease the score (/mediarestrict messages <integer bigger or equal to 1>).
                        if (parseInt(args[1]) >= 1) {
                            settings.maxMessages = parseInt(args[1]);
                            updateSettings();
                            ctx.replyWithHTML(
                                html`Media Restrict max messages is now ${settings.maxMessages}.`
                            );
                        } else if (parseInt(args[1]) < 1) {
                            ctx.replyWithHTML(
                                html`Media Restrict max messages cannot be lower than 1.`
                            );
                        } else {
                            ctx.replyWithHTML(
                                html`Media Restrict max messages value is invalid.`
                            );
                        }
                    } else if (args[0] === "check") { // Change which type of media to check. (/mediarestrict check <option>).
                        if (args[1] === "username") { // Check Usernames in messages as media or not. (/mediarestrict check username).
                            if (settings.checkUsername) {
                                settings.checkUsername = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count usernames as media posts.`
                                );
                            } else {
                                settings.checkUsername = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count usernames as media posts.`
                                );
                            }
                        } else if (args[1] === "hashtag") { // Check Hashtags in messages as media or not. (/mediarestrict check hashtag).
                            if (settings.checkHashtag) {
                                settings.checkHashtag = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count hashtag as media posts.`
                                );
                            } else {
                                settings.checkHashtag = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count hashtag as media posts.`
                                );
                            }
                        } else if (args[1] === "url") { // Check URLs in messages as media or not. (/mediarestrict check url).
                            if (settings.checkURL) {
                                settings.checkURL = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count url as media posts.`
                                );
                            } else {
                                settings.checkURL = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count url as media posts.`
                                );
                            }
                        } else if (args[1] === "email") { // Check Emails in messages as media or not. (/mediarestrict check email).
                            if (settings.checkEmail) {
                                settings.checkEmail = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count email as media posts.`
                                );
                            } else {
                                settings.checkEmail = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count email as media posts.`
                                );
                            }
                        } else if (args[1] === "phone") { // Check Phones in messages as media or not. (/mediarestrict check phone).
                            if (settings.checkPhone) {
                                settings.checkPhone = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count phone as media posts.`
                                );
                            } else {
                                settings.checkPhone = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count phone as media posts.`
                                );
                            }
                        } else if (args[1] === "animation") { // Check Animation in messages as media or not. (/mediarestrict check animation).
                            if (settings.checkAnimation) {
                                settings.checkAnimation = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count animation as media posts.`
                                );
                            } else {
                                settings.checkAnimation = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count animation as media posts.`
                                );
                            }
                        } else if (args[1] === "audio") { // Check Audio in messages as media or not. (/mediarestrict check audio).
                            if (settings.checkAudio) {
                                settings.checkAudio = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count audio as media posts.`
                                );
                            } else {
                                settings.checkAudio = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count audio as media posts.`
                                );
                            }
                        } else if (args[1] === "document") { // Check Documents in messages as media or not. (/mediarestrict check document).
                            if (settings.checkDocument) {
                                settings.checkDocument = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count document as media posts.`
                                );
                            } else {
                                settings.checkDocument = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count document as media posts.`
                                );
                            }
                        } else if (args[1] === "photo") { // Check Photos in messages as media or not. (/mediarestrict check photo).
                            if (settings.checkPhoto) {
                                settings.checkPhoto = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count photo as media posts.`
                                );
                            } else {
                                settings.checkPhoto = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count photo as media posts.`
                                );
                            }
                        } else if (args[1] === "sticker") { // Check Stickers in messages as media or not. (/mediarestrict check sticker).
                            if (settings.checkSticker) {
                                settings.checkSticker = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count sticker as media posts.`
                                );
                            } else {
                                settings.checkSticker = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count sticker as media posts.`
                                );
                            }
                        } else if (args[1] === "video") { // Check Videos in messages as media or not. (/mediarestrict check video).
                            if (settings.checkVideo) {
                                settings.checkVideo = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count video as media posts.`
                                );
                            } else {
                                settings.checkVideo = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count video as media posts.`
                                );
                            }
                        } else if (args[1] === "videonote") { // Check Video Notes in messages as media or not. (/mediarestrict check videonote).
                            if (settings.checkVideoNote) {
                                settings.checkVideoNote = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count videonote as media posts.`
                                );
                            } else {
                                settings.checkVideoNote = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count videonote as media posts.`
                                );
                            }
                        } else if (args[1] === "voice") { // Check Voice in messages as media or not. (/mediarestrict check voice).
                            if (settings.checkVoice) {
                                settings.checkVoice = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count voice as media posts.`
                                );
                            } else {
                                settings.checkVoice = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count voice as media posts.`
                                );
                            }
                        } else if (args[1] === "contact") { // Check Contacts in messages as media or not. (/mediarestrict check contact).
                            if (settings.checkContact) {
                                settings.checkContact = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count contact as media posts.`
                                );
                            } else {
                                settings.checkContact = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count contact as media posts.`
                                );
                            }
                        } else if (args[1] === "dice") { // Check Dice in messages as media or not. (/mediarestrict check dice).
                            if (settings.checkDice) {
                                settings.checkDice = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count dice as media posts.`
                                );
                            } else {
                                settings.checkDice = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count dice as media posts.`
                                );
                            }
                        } else if (args[1] === "game") { // Check Games in messages as media or not. (/mediarestrict check game).
                            if (settings.checkGame) {
                                settings.checkGame = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count game as media posts.`
                                );
                            } else {
                                settings.checkGame = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count game as media posts.`
                                );
                            }
                        } else if (args[1] === "poll") { // Check Polls in messages as media or not. (/mediarestrict check poll).
                            if (settings.checkPoll) {
                                settings.checkPoll = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count poll as media posts.`
                                );
                            } else {
                                settings.checkPoll = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count poll as media posts.`
                                );
                            }
                        } else if (args[1] === "venue") { // Check Venue in messages as media or not. (/mediarestrict check venue).
                            if (settings.checkVenue) {
                                settings.checkVenue = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count venue as media posts.`
                                );
                            } else {
                                settings.checkVenue = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count venue as media posts.`
                                );
                            }
                        } else if (args[1] === "location") { // Check Location in messages as media or not. (/mediarestrict check location).
                            if (settings.checkLocation) {
                                settings.checkLocation = false;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will not count location as media posts.`
                                );
                            } else {
                                settings.checkLocation = true;
                                updateSettings();
                                ctx.replyWithHTML(
                                    html`Media Restrict will count location as media posts.`
                                );
                            }
                        } else {
                            ctx.replyWithHTML(
                                html`Media Restrict check option is invalid.`
                            );
                        }
                    } else if (args[0] === "settings") { // Print plugin settings (/mediarestrict settings).
                        ctx.replyWithHTML(
                            html`Media Restrict settings:
                            <code>
                            active: ${settings.active}
                            feedback: ${settings.feedback}
                            mutingTime: ${settings.mutingTime}
                            firstMedia: ${settings.firstMedia}
                            restrictScore: ${settings.restrictScore}
                            maxMedia: ${settings.maxMedia}
                            maxMessages: ${settings.maxMessages}
                            checkUsername: ${settings.checkUsername}
                            checkHashtag: ${settings.checkHashtag}
                            checkURL: ${settings.checkURL}
                            checkEmail: ${settings.checkEmail}
                            checkPhone: ${settings.checkPhone}
                            checkAnimation: ${settings.checkAnimation}
                            checkAudio: ${settings.checkAudio}
                            checkDocument: ${settings.checkDocument}
                            checkPhoto: ${settings.checkPhoto}
                            checkSticker: ${settings.checkSticker}
                            checkVideo: ${settings.checkVideo}
                            checkVideoNote: ${settings.checkVideoNote}
                            checkVoice: ${settings.checkVoice}
                            checkContact: ${settings.checkContact}
                            checkDice: ${settings.checkDice}
                            checkGame: ${settings.checkGame}
                            checkPoll: ${settings.checkPoll}
                            checkVenue: ${settings.checkVenue}
                            checkLocation: ${settings.checkLocation}
                            </code>`
                        );
                    } else { // Invalid arguments, show Media Restrict commands.
                        ctx.replyWithHTML(
                            html`Media Restrict usage:
                            <code>/mediarestrict argument value</code>\n
                            Media Restrict arguments:\n
                            <code>on</code> - Enables Media Restrict.
                            <code>off</code> - Disables Media Restrict.
                            <code>feedback</code> - Provides feedback when an user is restricted.
                            <code>mute</code> - Changes the muting time, in seconds, cannot be lower than 300 seconds (5 minutes).
                            <code>first</code> - Changes whether to restrict users if their first seen message is media.
                            <code>score</code> - Changes the max score an user can accumulate before being restrcited, cannot be lower than 1.
                            <code>media</code> - Changes the max media threshold, cannot be lower than 1 message.
                            <code>messages</code> - Changes the max messages threshold, cannot be lower than 1 message.
                            <code>check</code> - Changes which type of content is considered a media post, check documentation for options.
                            <code>settings</code> - Shows the current settings for Media Restrict.`
                        );
                    }
                }
            }
            ctx.deleteMessage(ctx.message?.message_id);
        }
    }

    let inList = false;

    let restrictReason = "posting too many media messages";

    restrictList.forEach((s) => { if (s.user.id === ctx.from?.id && s.chat === String(ctx.chat?.id)) { inList = true } })

    //logError("[mediarestrict] New Message from Member in List: " + inList);

    if (settings.active && !ctx.from?.is_bot && !inList && (adminList.indexOf(ctx.from?.id) < 0)) {
        const s = restricting(ctx, ctx.from);
        restrictList.push(s);
        s.chat = String(ctx.chat?.id);
    }

    const currentMessage = restrictList.find(
        (x) => (x.user.id === ctx.from?.id && x.chat === String(ctx.chat?.id))
    );

    if (!currentMessage) {
        return next();
    }

    let hasMedia = false;

    // Media Post Checking Block

    if (settings.checkUsername || settings.checkHashtag || settings.checkURL || settings.checkEmail || settings.checkPhone) {
        if (ctx.message?.entities?.length > 0) {
            for (let i = 0; i < ctx.message?.entities?.length; i++) {
                let foundType = ctx.message?.entities?.[i].type;
                if (foundType === "mention" || foundType === "hashtag" || foundType === "url" || foundType === "email" ||
                    foundType === "phone_number" || foundType === "text_link" || foundType === "text_mention") {
                    hasMedia = true;
                    //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a MessageEntity: " + foundType);
                }
            }
        }
    }

    if (settings.checkAnimation) {
        let foundAnimation = ctx.message?.animation;
        if (foundAnimation != undefined || foundAnimation != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted an Animation");
        }
    }

    if (settings.checkAudio) {
        let foundAudio = ctx.message?.audio;
        if (foundAudio != undefined || foundAudio != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted an Audio file");
        }
    }

    if (settings.checkDocument) {
        let foundDocument = ctx.message?.document;
        if (foundDocument != undefined || foundDocument != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Document");
        }
    }

    if (settings.checkPhoto) {
        let foundPhoto = ctx.message?.photo;
        if (foundPhoto != undefined || foundPhoto != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Photo");
        }
    }

    if (settings.checkSticker) {
        let foundSticker = ctx.message?.sticker;
        if (foundSticker != undefined || foundSticker != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Sticker");
        }
    }

    if (settings.checkVideo) {
        let foundVideo = ctx.message?.video;
        if (foundVideo != undefined || foundVideo != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Video");
        }
    }

    if (settings.checkVideoNote) {
        let foundVideoNote = ctx.message?.video_note;
        if (foundVideoNote != undefined || foundVideoNote != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Video Note");
        }
    }

    if (settings.checkVoice) {
        let foundVoice = ctx.message?.voice;
        if (foundVoice != undefined || foundVoice != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Voice Message");
        }
    }

    if (settings.checkContact) {
        let foundContact = ctx.message?.contact;
        if (foundContact != undefined || foundContact != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Contact");
        }
    }

    if (settings.checkDice) {
        let foundDice = ctx.message?.dice;
        if (foundDice != undefined || foundDice != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Dice");
        }
    }

    if (settings.checkGame) {
        let foundGame = ctx.message?.game;
        if (foundGame != undefined || foundGame != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Game");
        }
    }

    if (settings.checkPoll) {
        let foundPoll = ctx.message?.poll;
        if (foundPoll != undefined || foundPoll != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Poll");
        }
    }

    if (settings.checkVenue) {
        let foundVenue = ctx.message?.venue;
        if (foundVenue != undefined || foundVenue != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Venue");
        }
    }

    if (settings.checkLocation) {
        let foundLocation = ctx.message?.location;
        if (foundLocation != undefined || foundLocation != null) {
            hasMedia = true;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " posted a Location");
        }
    }

    // Increase counters for text or media messages by this user.

    if (!hasMedia) {
        currentMessage.messageCounter = currentMessage.messageCounter + 1;
    } else {
        currentMessage.mediaCounter = currentMessage.mediaCounter + 1;
    }

    // Decrease media posting score if the text message threshold is reached.
    if (currentMessage.messageCounter >= settings.maxMessages) {
        currentMessage.postingScore = currentMessage.postingScore - 1;
        currentMessage.messageCounter = 0;
        //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " reached text message threshold, decreasing score to " + currentMessage.postingScore);
        if (currentMessage.postingScore <= 0) {
            currentMessage.postingScore = 0;
        }
        if (currentMessage.firstMediaPost) {
            currentMessage.firstMediaPost = false;
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " first seen post wasn't Media");
        }
    }

    // Increase media posting score if the media message threshold is reached.
    if (currentMessage.mediaCounter >= settings.maxMedia) {
        currentMessage.postingScore = currentMessage.postingScore + 1;
        currentMessage.mediaCounter = 0;
        //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " reached media message threshold, increasing score to " + currentMessage.postingScore);
        // Max out the posting score if the very first message seen from this user is a media post.
        if (settings.firstMedia && currentMessage.firstMediaPost) {
            currentMessage.postingScore = settings.restrictScore;
            restrictReason = "first seen post by bot was Media";
            //logError("[mediarestrict] User " + ctx.from?.username + " in Chat " + ctx.chat?.title + " first seen post was Media");
        }
    }


    if (currentMessage.postingScore >= settings.restrictScore) {
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
        let restrictTime = settings.mutingTime / 60;
        let restrictMessage = "minutes";
        if ((restrictTime / 60) >= 1) {
            restrictTime = restrictTime / 60;
            if (restrictTime == 1) {
                restrictMessage = "hour";
            } else {
                restrictMessage = "hours";
            }
            if ((restrictTime / 24) >= 1) {
                restrictTime = restrictTime / 24;
                if (restrictTime == 1) {
                    restrictMessage = "day";
                } else {
                    restrictMessage = "days";
                }
            }
        }
        return Promise.all([
            (settings.feedback) ? ctx.replyWithHTML(html`${link(ctx.from)} has been restricted for: <code>${restrictReason}</code> for: <code>${restrictTime} ${restrictMessage}</code>`) : false,
            ctx.telegram.restrictChatMember(ctx.chat?.id, ctx.from?.id, currentOptions),
            ctx.deleteMessage(ctx.message?.message_id),
            currentMessage.postingScore = 0,
        ]).catch((err) => logError("[mediarestrict] " + err.message));
    }

    return next();
});