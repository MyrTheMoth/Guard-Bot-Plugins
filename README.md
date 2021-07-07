# Guard Bot Plugins
A collection of plug-ins for Telegram Group Administration Bot, [Guard Bot](https://github.com/thedevs-network/the-guard-bot).

## Installation

Place each file you are interested in Guard Bot's `plugins` folder.

Edit the config.js file in your Guard Bot's folder and edit the `plugins:` parameter to include each plugin inside it's array as a string of the plugin's full file name.

Example: `plugins: ["raidmode.ts", "noinfokick.ts", "captcha.ts", "slowmode.ts"],`

## Captcha

This plugin is a modification of an older and simpler version of the captcha plugin circulating in Guard Bot's support chat, with some fixes for usability and feedback. Mainly, the older version had no way to tell which chat the challenges were being issued, this one makes sure to map the challenges per-user-per-chat to avoid issues if the same person joins multiple chats at once, it also has easier challenges, max attempts, restricts new members to only being able to send text messages until they get verified, deletes all messages the new member posted during the captcha challenge, provides feedback when the answer is incorrect and when it is correct, among other new features from the original.

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- active: A Boolean, if true, the bot will issue Captcha challenges, can be turned off and on with a `/captcha on|off` command.
- seconds: An Integer, the time in seconds a new member will have to answer the challenge before being kicked out.
- kickCooldown: An Integer, the time in seconds a new member will be kicked out of the chat for after failing to answer within the challenge time or exceeding the max attempts.
- strict: A Boolean, if true, the bot will delete all messages the user posted during the challenge, whether they pass or fail, for clean up.
- maxAttempts: An Integer, the maximum number of wrong answers the user can provide before the bot kicks them out.
- unverifiedOptions: A set of Booleans, the permissions a new member will have once they join the chat and before the pass the challenge.
- verifiedOptions: A set of Booleans, the permissions given to a new member once they pass the challenge.
- numbers and calc: An array of Numbers and a set of String operators, these will determine the values and operations used at random when each challenge is issued.

A different parallel version of this plugin, also based on the older simple one, can be found at https://gist.github.com/poeti8/d84dfc4538510366a2d89294ff52b4ae

## No Info Kick

This plugin checks each new member's profiles and kicks any member whose profiles are incomplete depending on your criteria, it will check if they have a Username, Profile Picture or Bio, and depending on how many of these they lack, they'll be kicked automatically, adjustable with the tolerance value, useful to remove suspicious users that are more likely to be userbots and spammers than actual users.

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- active: A Boolean, if true, the bot will kick new members with incomplete profiles, can be turned off and on with a `/noinfokick on|off` command.
- kickCooldown: An Integer, the time in seconds a new member will be kicked out of the chat after filing to pass the profile check.
- checkUsername: A Boolean, if true, the bot will check if the new member has an username, if they don't, they fail this check.
- checkPicture: A Boolean, if true, the bot will check if the new member has a profile picture, if they don't, they will fail this check.
- checkBio: A Boolean, if true, the bot will check if the new member has a bio, if they don't, they will fail this check.
- feedback: A Boolean, if true, the bot will provide feedback each time a new member is kicked out for failing the profile check.
- tolerance: A Number, a value from 1 to 3, determines the number of profile checks the new member must fail to be kicked out, 2 out of 3 by default.

## Raid Mode

This plugin kicks all new members, no questions asked, useful when your chat is experiencing a disruptive influx of spam bots and malicious users joining in massive numbers.

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- active: A Boolean, default false, if true, the bot will kick all new members, no questions asked, can be turned off and on with a `/raidmode on|off` command.
- kickCooldown: An Integer, the time in seconds a new member will be kicked out of the chat during raid mode.
- feedback: A Boolean, if true, it provides feedback on why new members are being kicked, default is false.

## Slow Mode

This plugin will mute members that post too many messages too quickly, useful to deal with spammers when moderators are away or overwhelmed, so they may deal with spammers before they can cause too much harm.

### Settings

The important variables and settings are commented in the code, here's the most important parts:

- active: A Boolean, if true, the bot will mute any user that posts too many messages too fast, can be turned off and on with a `/slowmode on|off` command.
- mutingTime: An Integer, time in seconds for spamming chat member to be muted for.
- postingInterval: An Integer, time in seconds to be counted between each message for it to count as a penalty.
- maxMessages: An Integer, number of messages that can be posted in succession within the postingInterval, user will be muted if they exceed it.
- mutedOptions: A set of Booleans, the permissions given to a muted user.

## Credits

Special thanks to the folk in Guard Bot's support chat who were a great help in the making of these and provided the early version of the captcha plugin I based most of these on.

Guard Bot project can be found at: https://github.com/thedevs-network/the-guard-bot
