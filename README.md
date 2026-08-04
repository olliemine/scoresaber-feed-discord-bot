# BS Local Bot

Customizable Discord bot for local Beat Saber servers. Tracks ScoreSaber players/maps, posts map + player feeds, handles login/roles, playlists, etc.

This README is a baseline, not the finished docs. A lot of the old notebook stuff was outdated so this was checked against the current code/`schema.json`.

---

## Setup

Needs:
- Node (modern enough for discord.js v14 / ES modules)
- MongoDB
- A Discord bot with **Server Members Intent** + **Message Content Intent** enabled
- `ffmpeg` on `PATH`, only needed for the Rankedle game

1. Clone the repo
2. `npm install`
3. Copy `.env.example` → `.env` and fill:
   - `DISCORD_TOKEN`
   - `MONGODB_URI`
   - (optional testing) `DISCORD_TOKEN_TESTING`, `MONGODB_URI_TESTING`
4. Copy `config.example.json` → `config.json` (and optionally `testconfig.example.json` → `testconfig.json`)
5. Fill `server-id`, channels, roles, feed messages, etc. Schema is in `schema.json` (`"$schema": "./schema.json"` helps in editors)
6. `npm run build`
7. `npm start`

`testMode: true` in `config.json` makes it load `testconfig.json` + the testing env vars instead.

`masters-user-ids` can run destructive stuff like wipe commands, be careful.

---

## Table of contents
- [Message sintax (shared)](#message-sintax-shared)
- [Map feed](#map-feed)
  - [Unknowns](#unknowns)
  - [Feed options](#feed-options)
  - [ChannelMapFeedConfiguration](#channelmapfeedconfiguration)
  - [FeedsEnabled](#feedsenabled)
  - [Map message tags](#map-message-tags)
  - [Map buttons / pictures](#map-buttons--pictures)
- [Player feed](#player-feed)
- [players update roles](#players-update-roles)
- [getplayer embed config](#getplayer-embed-config)
- [Rankedle](#rankedle)
- [Birthdays](#birthdays)

---

## Message sintax (shared)

Feeds and `getplayer` all use the same replacement system.

### Tags
Anything like `{Player_A_scorePP}` gets replaced if that tag exists for that message type.

### If statements
Syntax:

```text
[optional text that only shows if the tag has a value]TagName
```

Examples from real configs:

```text
[ · {Player_A_scorePP}pp]Player_A_scorePP
[\nHispanic rank: #{mainCountriesRank}]mainCountriesRank
[\n\nTambién ha superado a **{SnipedUsersExceptFirst}**]SnipedUsersExceptFirst
```

Rules:
- No space between `]` and the condition word
- Put `/` before `{` or `[` if you want the literal character and not sintax (`/{notATag}`, `/[not an if]whatever`)

### Message types
`feedMessages` / `getplayer` can be:

**message**
```json
{ "type": "message", "message": "text here", "buttons": ["beatsaver"] }
```

**embed**
```json
{
  "type": "embed",
  "embedTitle": "...",
  "embedDescription": "...",
  "embedFields": {
    "1": ["Field name", "Field value", false, "optionalIfTag"]
  },
  "embedColor": { "type": "color", "value": "#f1c40f" },
  "embedThumbnail": "...",
  "embedImage": "...",
  "embedURL": "...",
  "buttons": ["scoresaber"]
}
```

`embedFields` entry = `[name, value, inline?, onlyIfTag?]`. If the 4th value is set, that field (and its body) is skipped when the tag is empty.

`embedColor.type`:
- `color` → normal discord color / hex
- `image` → pulls vibrant color from whatever picture tag you put in `value`

---

# Map feed

## Unknowns
Behaviour of unknowns (players from `main-countries` who arent in the discord / arent logged in normally) is under `database.maps.Unknowns`:

- **searched**: Whether unknowns should be map searched. If true they get searched/logged and show on leaderboards. Note: options below are mostly about **feed messages**, the actual stored leaderboard still has the correct people
- **findUntilNotUnknown**: When looking for who got sniped, if the person below is Unknown and `canBeSniped` is false, keep walking down the leaderboard until a non-unknown (or stop if this is false)
- **canHaveTopPlay**: Whether unknowns can fire TopPlay (Personal / Country / All)
- **canBeSniped**: Whether unknowns can be PlayerB in a snipe (Top1 / Snipe)
- **canSnipe**: Whether unknowns can be PlayerA and snipe someone
- **canSnipeUnknowns**: Whether unknowns can snipe eachother (credit Hexi)
- **canHaveBetterScore**: BetterPlay / BetterTopPlay for unknowns
- **canDoNewPlay**: NewPlay for unknowns
- **canDoNewMap**: NewMap for unknowns

Theres also `database.players.Unknowns.SaveUnknowns` which is separate (whether unknown players get saved in the player db at all).

## Feed options
Clarification:
- **PlayerA** = the one who did the play
- **PlayerB** = only on Snipe-type events, the person now below PlayerA

Under `database.maps.feed`:

- **doPingsPlayerA**: if true and theyre in the server, try to mention them in `{Player_A_name}`
- **doPingsPlayerB**: same for PlayerB
- Both get ignored if that users config has **`doPingSnipe: false`**
- **betterPlayPercentage**: (optional, default `2`) 0-99, how many % better the score needs to be vs their last play to count as BetterPlay
- **top1IfNoUsers**: (optional, default `false`) if false, Top1 / BetterTopPlay wont fire when theres nobody else on that leaderboard context. If true, solo top1 still posts

## ChannelMapFeedConfiguration
Object (or array of them) in `maps.feed.feeds`:

- **Channel**: discord channel id. Dont repeat the same channel object as another entry carelessly
- **Feeds**: `"all"` or an array of feed strings, see [FeedsEnabled](#feedsenabled)
- **Types**: (optional, default `"both"`) `"ranked"` | `"unranked"` | `"both"` — which maps that channel cares about

`feedMessages` keys can be just the event (`"Top1"`) or event+context (`"Top1MainCountries"`). Specific wins over generic.

## FeedsEnabled

**Registered** here means the dataUser is tied to a discord user + scoresaber account.

### Contexts (implemented)
- **All**: all users in the db (for that map leaderboard context)
- **MainCountries**: users from `main-countries` (registered or unknowns depending on Unknowns config)

### Events
Feed string = `Event` + `Context` stuck together, examples: `Top1MainCountries`, `BetterPlayAll`, `NewMapMainCountries`.

TopPlay is special, its contexts are Personal / Country / All:
- `TopPlayPersonal`
- `TopPlayCountry`
- `TopPlayAll`

| Feed | Type | Meaning |
|---|---|---|
| **Top1** | Snipe | Best score in that context, and they werent already #1 |
| **Snipe** | Snipe | Sniped someone, doesnt have to be #1 |
| **BetterTopPlay** | Score (priority-ish) | Was already #1, improved their #1 |
| **BetterPlay** | Score | Improved their own score by more than `betterPlayPercentage` |
| **NewMap** | Score | Nobody in that context had the map yet |
| **NewPlay** | Score | Map already existed in context, but first time for this user |
| **TopPlayPersonal** | Score | New personal best pp play |
| **TopPlayCountry** | Score | New #1 top pp play in their country (among tracked users) |
| **TopPlayAll** | Score | New #1 top pp play among all tracked users |

### Priority
Actual order when a play comes in (`runPlay`):

`Top1 > BetterTopPlay > Snipe > BetterPlay > NewMap > NewPlay`

TopPlay is handled separately:

`TopPlayAll > TopPlayCountry > TopPlayPersonal`

Context preference inside one event:
- Snipe-ish checks (Top1 / BetterTopPlay / Snipe): tries **All** then **MainCountries**
- Score-ish checks (BetterPlay / NewPlay): tries **MainCountries** then **All**

First match posts and stops for that channel.

## Map message tags

Anything listed as Player_A also works as Player_B on **Snipe events only** (Top1 / Snipe). Putting Player_B tags on a Score event will error on startup.

### Player
- `{Player_A_ID}`
- `{Player_A_name}` (pings if config allows)
- `{Player_A_link}`
- `{Player_A_country_name}`
- `{Player_A_country_code}`
- `{Player_A_country_flag}`
- `{Player_A_databaseRank}` rank inside the bot db
- `{Player_A_baseScore}`
- `{Player_A_modifiedScore}`
- `{Player_A_baseScorePercentage}`
- `{Player_A_modifiedScorePercentage}`
- `{Player_A_score}` / `{Player_A_scorePercentage}` 
- `{Player_A_modifiers}` like `NF,GN`
- `{Player_A_missCount}`
- `{Player_A_isFC}` → `FC` or `❌ FC`
- `{Player_A_misses}` → `FC` / `2 miss` / `❌ FC`
- `{Player_A_scorePP}`
- `{Player_A_scoreWeightedPP}` (ranked only; Player_B weighted pp is basically useless unless you re-rank their whole scoreset)
- `{Player_A_timeSet}` / `{Player_A_timeSince}` discord timestamp formats
- `{Player_A_timeSetText}` / `{Player_A_timeSinceText}` plain text versions
- `{Player_A_HMD}`
- `{Player_A_scoreDifference}` / `{Player_A_scoreDifferencePercentage}` vs their old play
- `{Player_A_averageTop1CountRate_server_2}`
- `{Player_A_averageTop1CountRate_country_rounded}`
- `{Player_A_averageTop1CountRate_server_ratio_ranked}`
  - shape: `averageTop1CountRate_(server|country)_(number|rounded|ratio)(_ranked)?`

### Old player values
Same idea with `old` prefix. Uses the previous leaderboard entry for that player.

Note: `Player_B_old...` is allowed by the regex but oldPlayerB is basically just PlayerB, so it doesnt really change anything.
Maybe later: `oldDatabaseRank`?

- `{Player_A_oldBaseScore}`
- `{Player_A_oldModifiedScore}`
- `{Player_A_oldBaseScorePercentage}`
- `{Player_A_oldModifiedScorePercentage}`
- `{Player_A_oldScore}` / `{Player_A_oldScorePercentage}`
- `{Player_A_oldModifiers}`
- `{Player_A_oldMissCount}`
- `{Player_A_oldIsFC}`
- `{Player_A_oldMisses}`
- `{Player_A_oldScorePP}`
- `{Player_A_oldTimeSet}` / `{Player_A_oldTimeSince}`
- `{Player_A_oldTimeSetText}` / `{Player_A_oldTimeSinceText}`

### Level
- `{Level_scoresaberLink}`
- `{Level_beatsaverLink}`
- `{Level_code}`
- `{Level_songName}`
- `{Level_songSubName}` e.g. songName `Hardware Store`, songSubName `(Sped Up Ver.)`
- `{Level_songAuthorName}`
- `{Level_mapperName}`
- `{Level_difficulty}` ScoreSaber style (`ExpertPlus`)
- `{Level_difficultyFormated}` readable (`Expert+`)
- `{Level_difficultyTiny}` `E, N, H, EX, EX+`
- `{Level_difficultyTiniest}` `E, N, H, EX, E+`
- `{Level_gameMode}` `Standard`, `OneSaber`, etc
- `{Level_ranked}` useful as an if-check
- `{Level_stars}`
- `{Level_creationDate}` / `{Level_creationSince}`

### Snipe only
- `{Snipe_differenceScore}`
- `{Snipe_differenceScorePercentage}`

## Map buttons / pictures

Buttons you can put in `buttons`:
- `beatsaver`
- `scoresaber` (map leaderboard)
- `scoresaberPlayerA`
- `scoresaberPlayerB`

Thumbnail / image / color-from-image tags:
- `PlayerAProfilePicture`
- `PlayerBProfilePicture`
- `MapCoverPicture`

---

# Player feed

Under `database.players.feed`.

## Feed options
- **doPingsPlayer**
- **doPingsSniped**
- Same overwrite rule: users `doPingSnipe: false` blocks pings

Player channel config (`players.feed.feeds`) only has:
- **Channel**
- **Feeds** (`"all"` or array)

No `Types` here, thats map-feed only.

## PlayerFeeds

### Contexts
- **All**
- **MainCountries**

### Events
Feed string examples: `GlobalRankMainCountries`, `CountryRankAll`, `MainCountriesRankMainCountries`

- **GlobalRank**
- **CountryRank**
- **MainCountriesRank**
- **Top1QuantityMaps**
- **Top1PercentageMaps**
- **AverageAccuracy**

`{Player_variable}` / `{Player_lastVariable}` / ranks mean different things depending on which event fired (pp rank change vs top1 count vs accuracy etc).

## Player message tags
`Player` and `Sniped` share the same tags:

- `{Player_name}` pings if allowed
- `{Player_scoresaber_id}`
- `{Player_scoresaber_name}`
- `{Player_scoresaber_link}`
- `{Player_discordName}`
- `{Player_country_name}` / `{Player_country_code}` / `{Player_country_flag}`
- `{Player_currentRank}`
- `{Player_lastRank}`
- `{Player_globalRank}`
- `{Player_countryRank}`
- `{Player_variable}`
- `{Player_lastVariable}`

Time tags = time of last feed update for that tracked value. For Player its basically "now"/current update side; for Sniped its when they were sitting in that spot:

- `{Player_timeSet}` / `{Player_timeSince}`
- `{Player_timeSetText}` / `{Player_timeSinceText}`

Also (no `{}` braces in the condition side if used as ifs, but in the message itself they are normal tags):

- `{SnipedUsers}` → `Morphites, olliemine`
- `{SnipedUsersExceptFirst}`
- `{Update_block}` asciidoc codeblock table of +/− changes

### Player buttons / pictures
- buttons: `scoresaberPlayer`, `scoresaberSniped`
- pictures: `PlayerProfilePicture`, `SnipedProfilePicture`

---

# players update roles

`database.players.roles`:

- **GiveRankRolestoInactiveUsers**: if false, inactive people get rank roles stripped instead of assigned
- **list**: array of role rules

Each rule:
- **from** — max rank number that still gets the role (worse rank = higher number). Rank has to be `<= from`
- **to** — min rank number (best side). Rank has to be `>= to`. `0` means no minimum (open-ended towards #1)
- **ids** — discord role ids to give
- **country** — (optional) array of country codes this rule applies to, e.g. `["ES"]`. Empty / omitted = no country filter
- **global** — (optional, default false) if true use global ScoreSaber rank, else country rank

Example idea: top 10 country gets a role → `"from": 10, "to": 1, "global": false, "ids": ["..."]`

---

# getplayer embed config

Configured at `commands.getplayer` (same message/embed sintax as feeds).

## Tags
- `{scoresaber_id}`
- `{scoresaber_name}`
- `{scoresaber_link}`
- `{discordName}`
- `{country_name}` / `{country_code}` / `{country_flag}`
- `{pp}`
- `{rank}`
- `{countryRank}`
- `{mainCountriesRank}` (only if theyre in db / calculable)
- `{role}`
- `{banned}`
- `{inactive}`
- `{totalScore}`
- `{totalRankedScore}`
- `{totalPlayCount}`
- `{rankedPlayCount}`
- `{replaysWatched}`
- `{topPlayPP}` → something like `Song - 450.12pp`
- `{weekDifference}`
- `{serverTop1Count}`
- `{serverTop1RankedCount}`
- `{countryTop1Count}`
- `{countryTop1RankedCount}`

### averageRankedAccuracy
- `{averageRankedAccuracy_round}` fully rounded
- `{averageRankedAccuracy_2}` fixed to N decimals (max 14)

(old notes said `_raw` / `_rounded` — thats wrong now)

### averageTop1CountRate
- `{averageTop1CountRate_server_2}`
- `{averageTop1CountRate_server_rounded}`
- `{averageTop1CountRate_server_ratio}` → `a of b` style
- `{averageTop1CountRate_country_ratio_ranked}`
- shape: `averageTop1CountRate_(server|country)_(number|rounded|ratio)(_ranked)?`

## EmbedThumbnail
- `none` → no thumbnail
- `scoresaber` → scoresaber pfp
- `discordUser` → discord pfp if we have them, else nothing useful (name is `discordUser`, not `discord`)

## EmbedURL
- `none`
- `scoresaber`

## EmbedColor
- `{ "type": "color", "value": "#4C9CF6" }` or legacy color names
- `{ "type": "image", "value": "scoresaber" }` / `"discordUser"` → vibrant color from that picture

---

# Rankedle

Song guessing game.

Requires `ffmpeg` on `PATH`. Songs are picked from ScoreSaber `/api/v2/maps?status=RANKED`, audio and covers come from BeatSaver. Downloaded maps are cached under `data/rankedle/` and deleted when the game ends.

The global leaderboard lives in `data/rankedleLeaderboard.json`.

`commands.rankedle`:

- `channelId`: where the game is played
- `countdownSeconds`: join window before round 1
- `audioClipDuration`: seconds of audio per round
- `extendedAudioClipDuration`: seconds for the extended audio hint
- `maxPointsPerGame`: points needed to win
- `waitBetweenRounds`: pause between rounds
- `roundTimeLimit`: seconds to guess before the round times out
- `downloadTimeoutMS`: map download is aborted past this and another song is picked
- `minStars` / `maxStars`: optional star bounds for the maps that get picked
- `embedColor`: `"#RRGGBB"` string, unlike the `{ value, type }` form used by feed/getplayer embeds

Subcommands: `start`, `join`, `leave`, `hint`, `voteskip`, `leaderboard [page]`, plus `stop` and `skip` for admins.

A round ends early when someone guesses, an admin skips, or every player votes to skip. If a whole round passes with no messages from any player the game ends on inactivity.

---

# Birthdays

`/birthday` with `add`, `edit`, `delete`, `list`, `recent`, and `ban` for admins. Dates are `dd-MM-yyyy`.

Stored in `data/birthdays.json`. Entries are matched by Discord ID, falling back to username so rows written by older versions keep working.

`commands.birthdays`:

- `channelId`: where birthdays are announced. While empty nothing is announced, the commands still work
- `announceHourUTC`: hour of the day (UTC) to announce at

The announcement is scheduled with a timer to the next occurrence of that hour rather than polled.

---

## Random other config youll hit

- `main-countries`: country codes the bot treats as "local", e.g. `["ES"]`
- `admin-roles` / `masters-user-ids`
- `database.user-login`: nicknames, give-roles per category, verification channel, default `doSnipePing`
- `database.players.update.ppLimit` For unknowns only, if their pp is below this they stop being actively saved/updated
- `enable-updates-for-NonMainCountryUsers` if false, NonMainCountryUsers get dropped from active update tracking
- `suspendedUsersForLeaderboards` / `suspendedUsersForMapLeaderboards` Whether Inactive + Banned users count in ranked calculation
- `loadingEmoji` / `scoresaberEmoji` / `beatsaverEmoji` - Different emojis (id) for button and message purposes
- `commands.disabling`: command names to turn off
- `debug`: 0-4

If something in here disagrees with `schema.json`, trust the schema + the code. This file will drift again eventually.
