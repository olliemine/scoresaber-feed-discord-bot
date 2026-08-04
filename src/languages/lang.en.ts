export default {
	/**
	 * Errors
	 */
	invalidString: "Please input a valid string",
	invalidUser: "Please input a valid user",
	userYourNotFound: "Your user hasn't been found",
	userNotFound: "No user was found",
	unexpectedError: "Unexpected error",
	userAlreadyLoggedIn: "You are already logged in",
	userNeedsToBeLoggedIn: "You need to be logged in to use this command",
	accountDoesntSavePlays: "Your account doesn't save plays",
	incorrectChannel: "This channel does not allow bot commands",

	/**
	 * Single words
	 */
	userCategory: "User",
	closed: "closed",
	loading: "Loading",
	page: "Page",
	seconds: "seconds",
	previousPage: "Previous",
	nextPage: "Next",

	/**
	 * Titles
	 */
	successTitle: "Success",
	errorTitle: "Error",
	partialSuccessTitle: "Partial success",

	/**
	 * Updating users
	 */
	updatingUser: "Updating user information",
	gettingPlays: "Getting plays",

	/**
	 * Command parameters
	 */
	scoresaberPlayerDescription: "ID, name or link of a ScoreSaber account",
	
	/**
	 * Change name command
	 */
	changeNameDescription: "Change your name",
	changeNameStringOptionDescription: "Your new name",
	changeNameSuccess: "Changed name to: ",
	changeNameError: "It was not possible to change your name",

	/**
	 * Warnings
	 */
	rolesError: "Unable to apply/remove the following roles",

	/**
	 * Link command
	 */
	linkDescription: "Link your ScoreSaber account",
	
	/**
	 * Logout command
	 */
	logoutDescription: "Logout of your account",
	logoutSuccess: "Successfully logged out",

	/**
	 * User update command
	 */
	updateDescription: "Self refresh",
	updateNoUpdate: "User is already fully refreshed",
	updateSuccess: "Succesfully refreshed",
	updateError: "Failed to update",
	updatePartialSuccess: "Succesfully refreshed with some warnings",
	updateErrorFooter: "An unexpected error has occured, error logged in console",
	userPlayerUpdateFeedError: "Could update user without updating feed",
	
	/**
	 * User update debug
	 */
	updateDebugUpdate: "updated",
	updateDebugAverageAccuracy: "Average Accuracy updated",
	updateDebugPP: "PP updated",
	updateDebugMemberChanges: "Applied name changes and role changes",

	/**
	 * Visitor command
	 */
	visitor: "visitor",
	visitorDescription: "Login as visitor",
	visitorSuccess: "Successfully logged in as visitor",
	visitorUserIsNotVisitor: "You are not a visitor",

	/**
	 * Login responses
	 */
	loginUserAlreadyExists: "User already exists, if you think this shouldn't happen please contact a admin",
	loginSuccessDescription: "Logged in with ",
	loginSuccessTitle: "Successfully logged in",
	loginDeny: "You cannot logout",

	/**
	 * Playlist descriptions
	 */
	playlistSnipeDescription: "Generates a playlist where the given player is above you in the map",
	playlistTop1Description: "Generates a playlist where the given player is top 1 in the map",
	playlistTop1ServerDescription: "Generates a playlist with maps where you are not top 1",
	playlistImproveDescription: "Generates a playlist with a sort.",
	
	/**
	 * Playlist parameters
	 */
	playlistPlayerDescription: "The user to generate the playlist",
	playlistLimitDescription: "The limit of maps in the playlist",
	playlistRankedDescription: "Whether the maps should be ranked",
	playlistMinNPSDescription: "The minimum of NPS that the maps should have",
	playlistMaxNPSDescription: "The maximum of NPS that the maps should have",
	playlistMinDateDescription: "Minimum date for the maps (YYYY-MM-DD)",
	playlistMaxDateDescription: "Maximum date for the maps (YYYY-MM-DD)",
	playlistMinStarsDescription: "The minimum of stars the ranked map should have",
	playlistMaxStarsDescription: "The maximum of stars the ranked map should have",
	playlistTagDescription: "Tag that the maps should have",
	playlistSortLowAcc: "Low acc",
	playlistSortOldest: "Oldest",
	playlistSortDescription: "How the playlist is going to be sorted",
	
	/**
	 * Playlist responses
	 */
	playlistCantSnipedSelf: "You can't snipe yourself!",
	playlistInvalidMinDate: "Invalid minDate, please use the format (YYYY-MM-DD)",
	playlistInvalidMaxDate: "Invalid maxDate, please use the format (YYYY-MM-DD)",
	playlistMinNPSNotGreaterThanMaxNPS: "Min NPS shouldn't be higher than max NPS",
	playlistMinDateNotGreaterThanMaxDate: "Min Date shouldn't be higher than max date",
	playlistMinStarsNotGreaterThanMaxStars: "Min Stars shouldn't be higher than max stars",
	playlistNoMapFound: "No map was found",
	playlistCreation: "Playlist created",
	playlistMapsFound: "maps found",
	
	/**
	 * User selection 
	 */
	userSelectionDescription: "There exists multiple users with the same name, please select the correct one:",
	userSelectionNotFound: "No user found. Please try searching by ID",

	/**
	 * Get player command
	 */
	getPlayerDescription: "Gets information about a player",

	/**
	 * Command errors
	 */
	commandNotEnoughPermissions: "This command can only be executed by a higher rank",
	commandTimeout: "Please wait a little bit before using the bot again",
	invalidCommand: "Invalid command",

	/**
	 * Rankedle command
	 */
	gameCategory: "Games",
	rankedleDescription: "Guess the ranked Beat Saber song",
	rankedleStartDescription: "Start a new Rankedle game",
	rankedleJoinDescription: "Join the running Rankedle game",
	rankedleLeaveDescription: "Leave the current Rankedle game",
	rankedleStopDescription: "Stop the current Rankedle game",
	rankedleSkipDescription: "Skip the current song",
	rankedleLeaderboardDescription: "Show the global leaderboard",
	rankedleHintDescription: "Reveal a hint about the current song",
	rankedleVoteskipDescription: "Vote to skip the current song",
	rankedlePageDescription: "Page number",

	/**
	 * Rankedle errors
	 */
	rankedleNotConfigured: "Rankedle has not been configured",
	rankedleWrongChannel: "The game can only be started in",
	rankedleGameInAnotherChannel: "The game is running in another channel",
	rankedleAlreadyActive: "A game is already running",
	rankedleNoActiveGame: "There is no running game",
	rankedleAlreadyJoined: "You are already playing",
	rankedleNotPlaying: "You are not playing",
	rankedleOnlyPlayers: "Only players can do that, join with /rankedle join",
	rankedleNoCurrentSong: "There is no song to act on",
	rankedleRoundAlreadyEnded: "This round has already ended",
	rankedleAlreadyVoted: "You already voted to skip this song",
	rankedleAllHintsUsed: "Every hint has already been used",
	rankedleLeaderboardEmpty: "The leaderboard is empty",
	rankedleInvalidPage: "The page must be between 1 and",
	rankedleSongError: "A song could not be found, the game has been stopped",
	rankedleUnexpectedStop: "An unexpected error occured, the game has been stopped",

	/**
	 * Rankedle responses
	 */
	rankedleJoined: "You joined the Rankedle game",
	rankedleLeft: "You left the Rankedle game",
	rankedleStopped: "Game stopped",
	rankedleJoinedAnnouncement: "joined the game",
	rankedleLeftAnnouncement: "left the game",
	rankedleVoteRegistered: "Your vote to skip has been registered",

	/**
	 * Rankedle game
	 */
	rankedleNewGameTitle: "New Rankedle game starting",
	rankedleSecondsToJoin: "seconds left to join the game!",
	rankedlePointsToWin: "points to win",
	rankedleGameStartedTitle: "The game has started",
	rankedleJoinWithCommand: "You can still join with /rankedle join",
	rankedleJoinButton: "Join the game",
	rankedleVoteskipButton: "Vote to skip",
	rankedlePlayers: "Players",
	rankedleNoPlayers: "None",
	rankedleRound: "Round",
	rankedleSearchingSong: "Looking for a random song",
	rankedleGuessPrompt: "Guess the name of this song",
	rankedleTimeLimit: "Time limit",
	rankedleHints: "Hints",
	rankedleHintHowTo: "Use /rankedle hint for a random hint",
	rankedlePoints: "points",
	rankedlePointsShort: "pts",
	rankedleSongBy: "by",
	rankedleSongWas: "The song was",
	rankedleGuessedIt: "guessed it",
	rankedleCorrectTitle: "Correct answer",
	rankedleCurrentScoreTitle: "Current score",
	rankedleTimeoutTitle: "Time is up",
	rankedleTimeoutDescription: "Nobody guessed it",
	rankedleSkippedTitle: "Song skipped",
	rankedleSkippedVoteTitle: "Song skipped by vote",
	rankedleAllVotedTitle: "Every player voted",
	rankedleSkipping: "Skipping song",
	rankedleInactivityTitle: "Game ended because of inactivity",
	rankedleInactivityDescription: "No participation was detected during the round",
	rankedleGameOverTitle: "Game over",
	rankedleFinalResults: "Final results",
	rankedleNoParticipants: "There were no participants",
	rankedleStoppedTitle: "Rankedle game stopped",
	rankedleStoppedByAdmin: "The game was stopped by an administrator",
	rankedleEveryoneLeft: "Every player left the game",
	rankedleLeaderboardTitle: "Rankedle global leaderboard",
	rankedleLeaderboardFull: "Use /rankedle leaderboard to see the full table",
	rankedleEmptyPage: "No players on this page",

	/**
	 * Rankedle hints
	 */
	rankedleHintTitle: "Hint",
	rankedleHintAudio: "Extended audio! Listen to a longer clip of the song",
	rankedleHintUploader: "Mapper hint: the song was uploaded by",
	rankedleHintDifficulties: "Difficulty hint, the song has the following difficulties",
	rankedleHintCover: "Visual hint: here is the cover art (slightly blurred)",
	rankedleHintCoverFallback: "Visual hint: here is the cover art",
	rankedleNotRanked: "Not ranked",

	/**
	 * Birthday command
	 */
	birthdayDescription: "Manage birthdays",
	birthdayAddDescription: "Save your birthday",
	birthdayEditDescription: "Change your birthday",
	birthdayDeleteDescription: "Delete your birthday",
	birthdayBanDescription: "Ban a user from the birthday commands",
	birthdayListDescription: "Show every birthday grouped by month",
	birthdayRecentDescription: "Show the upcoming birthdays",
	birthdayDateOptionDescription: "Your birthday, formatted as dd-MM-yyyy",
	birthdayUserOptionDescription: "The user to ban",

	/**
	 * Birthday responses
	 */
	birthdayInvalidFormat: "Invalid date, use the dd-MM-yyyy format (example: 15-03-1990)",
	birthdayInvalidYear: "Please enter a realistic year of birth",
	birthdayBanned: "You are banned from the birthday commands",
	birthdayAlreadyRegistered: "You already saved a birthday, use /birthday edit to change it",
	birthdayNotRegistered: "You have not saved a birthday, use /birthday add to save one",
	birthdayAdded: "Birthday saved",
	birthdayUpdated: "Birthday updated",
	birthdayDeleted: "Your birthday has been deleted",
	birthdayUserBanned: "has been banned from the birthday commands",
	birthdayListTitle: "Birthday list",
	birthdayListEmpty: "No birthdays have been saved yet",
	birthdayRecentTitle: "Upcoming birthdays",
	birthdayRegisteredCount: "birthdays saved",
	birthdayToday: "Today is their birthday",
	birthdayAnnouncementTitle: "Happy birthday",
	birthdayAnnouncementDescription: "is turning",

	/**
	 * TODO: admin commands
	 */

	/**
	 * Misc
	 */
	verificationChannelMessage: "**Enter your ScoreSaber name or id to be verified\nYou can also enter \"visitor\" to enter without account**"
}