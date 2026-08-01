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

	/**
	 * TODO: admin commands
	 */

	/**
	 * Misc
	 */
	verificationChannelMessage: "**Enter your ScoreSaber name or id to be verified\nYou can also enter \"visitor\" to enter without account**"
}