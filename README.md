# Guard Bot Plugins
A collection of plug-ins for Telegram Group Administration Bot, [Guard Bot](https://github.com/thedevs-network/the-guard-bot).

## Installation

Place each file you are interested in Guard Bot's `plugins` folder.

Edit the config.js file in your Guard Bot's folder and edit the `plugins:` parameter to include each plugin inside it's array as a string of the plugin's full file name.

Example: `plugins: ["raidmode.ts", "noinfokick.ts", "captcha.ts", "slowmode.ts"],`

Each plug-in will create a .json file with their own name in the plugin folder, to allow settings changed during runtime to persist across restarts.

## Captcha

This plugin is a modification of an older and simpler version of the captcha plugin circulating in Guard Bot's support chat, with some fixes for usability and feedback. Mainly, the older version had no way to tell which chat the challenges were being issued, this one makes sure to map the challenges per-user-per-chat to avoid issues if the same person joins multiple chats at once, it also has easier challenges, max attempts, restricts new members to only being able to send text messages until they get verified, deletes all messages the new member posted during the captcha challenge, provides feedback when the answer is incorrect and when it is correct, among other new features from the original.

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- `active`: A Boolean, if true, the bot will issue Captcha challenges.
- `challengeTimeout`: An Integer, the time in seconds a new member will have to answer the challenge before being kicked out.
- `kickCooldown`: An Integer, the time in seconds a new member will be kicked out of the chat for after failing to answer within the challenge time or exceeding the max attempts.
- `strict`: A Boolean, if true, the bot will delete all messages the user posted during the challenge, whether they pass or fail, for clean up.
- `maxAttempts`: An Integer, the maximum number of wrong answers the user can provide before the bot kicks them out.
- `exclude`: An Array of Strings, a list of chats to exclude from this plugin's functionality.
- `unverifiedOptions`: A set of Booleans, the permissions a new member will have once they join the chat and before the pass the challenge.
- `verifiedOptions`: A set of Booleans, the permissions given to a new member once they pass the challenge.
- `numbers` and `calc`: An array of Numbers and a set of String operators, these will determine the values and operations used at random when each challenge is issued.

### Commands

Captcha usage:

- `/captcha argument value`

Captcha arguments:

- `on` - Enables Captcha.
- `off` - Disables Captcha.
- `timeout` - Changes the challenge timeout, in seconds, cannot be lower than 300 seconds (5 minutes).
- `cooldown` - Changes the kick cooldown, in seconds, cannot be lower than 300 seconds (5 minutes).
- `strict` - Switches message deletion on challenge ending on and off, boolean, only accepts true or false.
- `attempts` - Changes the max number of attempts, cannot be lower than 1.
- `exclude` - Changes if the plugin will work on this chat or not.
- `settings` - Shows the current settings for Captcha.

A different parallel version of this plugin, also based on the older simple one, can be found at https://gist.github.com/poeti8/d84dfc4538510366a2d89294ff52b4ae

## No Info Kick

This plugin checks each new member's profiles and kicks any member whose profiles are incomplete depending on your criteria, it will check if they have a Username, Profile Picture or Bio, and depending on how many of these they lack, they'll be kicked automatically, adjustable with the tolerance value, useful to remove suspicious users that are more likely to be userbots and spammers than actual users.

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- `active`: A Boolean, if true, the bot will kick new members with incomplete profiles.
- `kickCooldown`: An Integer, the time in seconds a new member will be kicked out of the chat after filing to pass the profile check.
- `Username`: A Boolean, if true, the bot will check if the new member has an username, if they don't, they fail this check.
- `Picture`: A Boolean, if true, the bot will check if the new member has a profile picture, if they don't, they will fail this check.
- `Bio`: A Boolean, if true, the bot will check if the new member has a bio, if they don't, they will fail this check.
- `feedback`: A Boolean, if true, the bot will provide feedback each time a new member is kicked out for failing the profile check.
- `tolerance`: A Number, a value from 1 to 3, determines the number of profile checks the new member must fail to be kicked out, 2 out of 3 by default.

### Commands

No Info Kick usage:

- `/noinfokick argument value`

No Info Kick arguments:

- `on` - Enables No Info Kick.
- `off` - Disables No Info Kick.
- `cooldown` - Changes the kick cooldown, in seconds, cannot be lower than 300 seconds (5 minutes).
- `username` - Switches username checking on and off, boolean, only accepts true or false.
- `picture` - Switches picture checking on and off, boolean, only accepts true or false.
- `bio` - Switches bio checking on and off, boolean, only accepts true or false.
- `feedback` - Switches feedback messages on and off, boolean, only accepts true or false.
- `tolerance` - Changes the tolerance for failure, a number from 1 to 3.
- `settings` - Shows the current settings for No Info Kick.

## Raid Mode

This plugin kicks all new members, no questions asked, useful when your chat is experiencing a disruptive influx of spam bots and malicious users joining in massive numbers.

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- `active`: A Boolean, default false, if true, the bot will kick all new members, no questions asked.
- `kickCooldown`: An Integer, the time in seconds a new member will be kicked out of the chat during raid mode.
- `feedback`: A Boolean, if true, it provides feedback on why new members are being kicked, default is false.
- `joinDelete`: A Boolean, if true, it will delete all join messages, default is true.

### Commands

Raid Mode usage:
- `/raidmode argument value`

Raid Mode arguments:

- `on` - Enables Raid Mode.
- `off` - Disables Raid Mode.
- `cooldown` - Changes the kick cooldown, in seconds, cannot be lower than 300 seconds (5 minutes).
- `feedback` - Switches feedback messages on and off, boolean, only accepts true or false.
- `join` - Switches deleting join messages on and off, boolean, only accepts true or false.
- `settings` - Shows the current settings for Raid Mode.

## Slow Mode

This plugin will mute members that post too many messages too quickly, useful to deal with spammers when moderators are away or overwhelmed, so they may deal with spammers before they can cause too much harm.

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- `active`: A Boolean, if true, the bot will mute any user that posts too many messages too fast.
- `mutingTime`: An Integer, time in seconds for spamming chat member to be muted for.
- `postingInterval`: An Integer, time in seconds to be counted between each message for it to count as a penalty.
- `maxMessages`: An Integer, number of messages that can be posted in succession within the postingInterval, user will be muted if they exceed it.
- `mutedOptions`: A set of Booleans, the permissions given to a muted user.

### Commands

Slow Mode usage:
- `/slowmode argument value`

Slow Mode arguments:

- `on` - Enables Slow Mode.
- `off` - Disables Slow Mode.
- `mute` - Changes the muting time, in seconds, cannot be lower than 300 seconds (5 minutes).
- `interval` - Changes the interval time, in seconds, cannot be lower than 1 second.
- `messages` - Changes the max messages allowed, cannot be lower than 5 messages.
- `settings` - Shows the current settings for Slow Mode.

## New Restrict

This plugin will restrict new members to only be allowed to post text messages for a set amount of time (5 minutes by default).

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- `active`: A Boolean, if true, the bot will mute any user that posts too many messages too fast.
- `mutingTime`: An Integer, time in seconds for spamming chat member to be muted for.
- `mutedOptions`: A set of Booleans, the permissions given to a muted user.

### Commands

New Restrict usage:
- `/newrestrict argument value`

New Restrict arguments:

- `on` - Enables New Restrict.
- `off` - Disables New Restrict.
- `mute` - Changes the muting time, in seconds, cannot be lower than 300 seconds (5 minutes).
- `settings` - Shows the current settings for New Restrict.

## Media Restrict

This plugin will restrict members to only be able to post text messages when they post too many media or other types of message elements, or if the very first message seen by the bot is one of these types of messages.

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- `active`: A Boolean, if true, bot will mute users who post too many messages too quickly.
- `feedback`: A Boolean, if true, bot will post a message if an user is restricted.
- `mutingTime`: An Integer, the amount of time an user will be restricted for.
- `firstMedia`: A Boolean, if true, users will be restricted immediately if first message seen by the plug-in is some type of media.
- `restrictScore`: An Integer, the maximum amount of score an user is allowed to accumulate before being restricted.
- `maxMedia`: An Integer, the amount of media messages needed to increase an user's media posting score.
- `maxMessages`: An Integer, the amount of non-media messages needed to decrease the user's media posting score.
- `Username`: A Boolean, if true, @Username mentions count towards a media posting score.
- `Hashtag`: A Boolean, if true, #Hashtags count towards a media posting score.
- `URL`: A Boolean, if true, URLs (http(s)://www.example.com) count towards a media posting score.
- `Email`: A Boolean, if true, Emails (mail@example.com) count towards a media posting score.
- `Phone`: A Boolean, if true, Phone Numbers (+5 555-5555555) count towards a media posting score.
- `Animation`: A Boolean, if true, GIFs count towards a media posting score.
- `Audio`: A Boolean, if true, Audio counts towards a media posting score.
- `Document`: A Boolean, if true, Documents count towards a media posting score.
- `Photo`: A Boolean, if true, Photos count towards a media posting score.
- `Sticker`: A Boolean, if true, Stickers count towards a media posting score.
- `Video`: A Boolean, if true, Videos count towards a media posting score.
- `VideoNote`: A Boolean, if true, Video Notes count towards a media posting score.
- `Voice`: A Boolean, if true, Voice Notes count towards a media posting score.
- `Contact`: A Boolean, if true, sharing Contacts count towards a media posting score.
- `Dice`: A Boolean, if true, Dice messages count towards a media posting score.
- `Game`: A Boolean, if true, Games count towards a media posting score.
- `Poll`: A Boolean, if true, Polls count towards a media posting score.
- `Venue`: A Boolean, if true, Venues count towards a media posting score.
- `Location`: A Boolean, if true, Location counts towards a media posting score.

### Commands

Media Restrict usage:
- `/mediarestrict argument value`

Media Restrict arguments:

- `on` - Enables Media Restrict.
- `off` - Disables Media Restrict.
- `feedback` - Provides feedback when an user is restricted.
- `mute` - Changes the muting time, in seconds, cannot be lower than 300 seconds (5 minutes).
- `first` - Changes whether to restrict users if their first seen message is media.
- `score` - Changes the max score an user can accumulate before being restrcited, cannot be lower than 1.
- `media` - Changes the max media threshold, cannot be lower than 1 message.
- `messages` - Changes the max messages threshold, cannot be lower than 1 message.
- `check` - Changes which type of content is considered a media post, check documentation for options.
    - `username` - Change if @Username mentions count towards a media posting score or not.
    - `hashtag` - Change if #Hashtags count towards a media posting score or not.
    - `url` - Change if URLs (http(s)://www.example.com) count towards a media posting score or not.
    - `email` - Change if Emails (mail@example.com) count towards a media posting score or not.
    - `phone` - Change if Phone Numbers (+5 555-5555555) count towards a media posting score or not.
    - `animation` - Change if GIFs count towards a media posting score or not.
    - `audio` - Change if Audio files count towards a media posting score or not.
    - `document` - Change if Documents count towards a media posting score or not.
    - `photo` - Change if Photos count towards a media posting score or not.
    - `sticker` - Change if Stickers count towards a media posting score or not.
    - `video` - Change if Videos count towards a media posting score or not.
    - `videoNote` - Change if Video Notes count towards a media posting score or not.
    - `voice` - Change if Voice Notes count towards a media posting score or not.
    - `contact` - Change if sharing Contacts count towards a media posting score or not.
    - `dice` - Change if Dice messages count towards a media posting score or not.
    - `game` - Change if Games count towards a media posting score or not.
    - `poll` - Change if Polls count towards a media posting score or not.
    - `venue` - Change if Venues count towards a media posting score or not.
    - `location` - Change if Location counts towards a media posting score or not.
- `settings` - Shows the current settings for Media Restrict.

## Anti Anon

This plugin is a workaround for a new Telegram feature that allows users in public chats to post as an alternate anonymous identity and can be easily used to impersonate chat members or spread misinformation, this plugin will delete any messages posted under user id 777000, which the anonymous messages fall back to, posing as Telegram's own official service notification user id.

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- `active`: A Boolean, default false, if true, the bot will delete all anonymous messages.

### Commands

Anti Anon usage:
- `/antianon argument value`

Anti Anon arguments:

- `on` - Enables Anti Anon.
- `off` - Disables Anti Anon.
- `settings` - Shows the current settings for Anti Anon.

## Credits

Special thanks to the folk in Guard Bot's support chat who were a great help in the making of these and provided the early version of the captcha plugin I based most of these on.

Guard Bot project can be found at: https://github.com/thedevs-network/the-guard-bot
