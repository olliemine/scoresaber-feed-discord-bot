import { LanguageMessages } from "./lang.js";

export default {
	/**
	 * Errors
	 */
	invalidString: "Bitte gib einen gültigen Text ein",
	invalidUser: "Bitte gib einen gültigen User ein",
	userYourNotFound: "Dein User wurde nicht gefunden",
	userNotFound: "Kein User gefunden",
	unexpectedError: "Unerwarteter Fehler",
	userAlreadyLoggedIn: "Du bist bereits angemeldet",
	userNeedsToBeLoggedIn: "Du musst angemeldet sein, um diesen Befehl zu nutzen",
	accountDoesntSavePlays: "Dein Konto speichert keine Plays",
	incorrectChannel: "In diesem Kanal sind Bot-Befehle nicht erlaubt",

	/**
	 * Single words
	 */
	userCategory: "User",
	closed: "geschlossen",
	loading: "Laden",
	page: "Seite",
	seconds: "Sekunden",
	previousPage: "Zurück",
	nextPage: "Weiter",

	/**
	 * Titles
	 */
	successTitle: "Erfolg",
	errorTitle: "Fehler",
	partialSuccessTitle: "Teilerfolg",

	/**
	 * Updating users
	 */
	updatingUser: "Benutzerinformationen werden aktualisiert",
	gettingPlays: "Plays werden geladen",

	/**
	 * Command parameters
	 */
	scoresaberPlayerDescription: "ID, Name oder Link eines ScoreSaber-Kontos",
	
	/**
	 * Change name command
	 */
	changeNameDescription: "Ändere deinen Namen",
	changeNameStringOptionDescription: "Dein neuer Name",
	changeNameSuccess: "Name geändert",
	changeNameError: "Dein Name konnte nicht geändert werden",

	/**
	 * Warnings
	 */
	rolesError: "Folgende Rollen konnten nicht vergeben/entfernt werden",

	/**
	 * Link command
	 */
	linkDescription: "Verbinde dein ScoreSaber-Konto",
	
	/**
	 * Logout command
	 */
	logoutDescription: "Melde dich von deinem Konto ab",
	logoutSuccess: "Erfolgreich abgemeldet",

	/**
	 * User update command
	 */
	updateDescription: "Selbstaktualisierung",
	updateNoUpdate: "User ist bereits vollständig aktualisiert",
	updateSuccess: "Erfolgreich aktualisiert",
	updateError: "Aktualisierung fehlgeschlagen",
	updatePartialSuccess: "Erfolgreich aktualisiert, mit einigen Warnungen",
	userPlayerUpdateFeedError: "Benutzer konnte ohne Feed-Update aktualisiert werden",
	
	/**
	 * User update debug
	 */
	updateDebugUpdate: "aktualisiert",
	updateDebugAverageAccuracy: "Average Accuracy aktualisiert",
	updateDebugPP: "PP aktualisiert",
	updateDebugMemberChanges: "Namens- und Rollenänderungen angewendet",

	/**
	 * Visitor command
	 */
	visitor: "besucher",
	visitorDescription: "Als Besucher anmelden",
	visitorSuccess: "Erfolgreich als Besucher angemeldet",
	visitorUserIsNotVisitor: "Du bist kein Besucher",

	/**
	 * Login responses
	 */
	loginUserAlreadyExists: "Benutzer existiert bereits. Wenn das nicht sein sollte, kontaktiere bitte einen Admin",
	loginSuccessDescription: "Angemeldet mit ",
	loginSuccessTitle: "Erfolgreich angemeldet",
	loginDeny: "Du kannst dich nicht abmelden",

	/**
	 * Playlist descriptions
	 */
	playlistSnipeDescription: "Erstellt eine Playlist mit Maps, auf denen der angegebene Spieler über dir liegt",
	playlistTop1Description: "Erstellt eine Playlist mit Maps, auf denen der angegebene Spieler Top 1 ist",
	playlistTop1ServerDescription: "Erstellt eine Playlist mit Maps, auf denen du nicht Top 1 bist",
	playlistImproveDescription: "Erstellt eine sortierte Playlist",
	
	/**
	 * Playlist parameters
	 */
	playlistPlayerDescription: "Der User, für den die Playlist erstellt wird",
	playlistLimitDescription: "Maximale Anzahl an Maps in der Playlist",
	playlistRankedDescription: "Ob die Maps ranked sein sollen",
	playlistMinNPSDescription: "Minimaler NPS-Wert der Maps",
	playlistMaxNPSDescription: "Maximaler NPS-Wert der Maps",
	playlistMinDateDescription: "Mindestdatum der Maps (YYYY-MM-DD)",
	playlistMaxDateDescription: "Maximaldatum der Maps (YYYY-MM-DD)",
	playlistMinStarsDescription: "Minimale Sterne der ranked Maps",
	playlistMaxStarsDescription: "Maximale Sterne der ranked Maps",
	playlistTagDescription: "Tag, den die Maps haben sollen",
	playlistSortLowAcc: "Niedrige Acc",
	playlistSortOldest: "Älteste",
	playlistSortDescription: "Wie die Playlist sortiert werden soll",
	
	/**
	 * Playlist responses
	 */
	playlistCantSnipedSelf: "Du kannst dich nicht selbst snipen!",
	playlistInvalidMinDate: "Ungültiges minDate, bitte nutze das Format (YYYY-MM-DD)",
	playlistInvalidMaxDate: "Ungültiges maxDate, bitte nutze das Format (YYYY-MM-DD)",
	playlistMinNPSNotGreaterThanMaxNPS: "Min NPS darf nicht höher als Max NPS sein",
	playlistMinDateNotGreaterThanMaxDate: "Min Date darf nicht später als Max Date sein",
	playlistMinStarsNotGreaterThanMaxStars: "Min Stars darf nicht höher als Max Stars sein",
	playlistNoMapFound: "Keine Map gefunden",
	playlistCreation: "Playlist erstellt",
	playlistMapsFound: "maps gefunden",
	
	/**
	 * User selection 
	 */
	userSelectionDescription: "Es gibt mehrere Users mit demselben Namen, bitte wähle den richtigen aus:",
	userSelectionNotFound: "Kein User gefunden. Bitte versuche die Suche per ID.",

	/**
	 * Get player command
	 */
	getPlayerDescription: "Zeigt Informationen über einen Spieler",

	/**
	 * Command errors
	 */
	commandNotEnoughPermissions: "Dieser Befehl kann nur von einem höheren Rang ausgeführt werden",
	commandTimeout: "Bitte warte kurz, bevor du den Bot erneut nutzt",
	invalidCommand: "Ungültiger Befehl",

	/**
	 * Rankedle command
	 */
	gameCategory: "Spiele",
	rankedleDescription: "Errate den ranked Beat Saber Song",
	rankedleStartDescription: "Starte ein neues Rankedle-Spiel",
	rankedleJoinDescription: "Tritt dem laufenden Rankedle-Spiel bei",
	rankedleLeaveDescription: "Verlasse das aktuelle Rankedle-Spiel",
	rankedleStopDescription: "Beende das aktuelle Rankedle-Spiel",
	rankedleSkipDescription: "Überspringe den aktuellen Song",
	rankedleLeaderboardDescription: "Zeige das globale Leaderboard",
	rankedleHintDescription: "Zeige einen Hinweis zum aktuellen Song",
	rankedleVoteskipDescription: "Stimme dafür, den aktuellen Song zu überspringen",
	rankedlePageDescription: "Seitennummer",

	/**
	 * Rankedle errors
	 */
	rankedleNotConfigured: "Rankedle wurde nicht konfiguriert",
	rankedleWrongChannel: "Das Spiel kann nur gestartet werden in",
	rankedleGameInAnotherChannel: "Das Spiel läuft in einem anderen Kanal",
	rankedleAlreadyActive: "Es läuft bereits ein Spiel",
	rankedleNoActiveGame: "Es läuft kein Spiel",
	rankedleAlreadyJoined: "Du spielst bereits mit",
	rankedleNotPlaying: "Du spielst nicht mit",
	rankedleOnlyPlayers: "Das können nur Mitspieler, tritt mit /rankedle join bei",
	rankedleNoCurrentSong: "Es gibt keinen Song, auf den reagiert werden kann",
	rankedleRoundAlreadyEnded: "Diese Runde ist bereits beendet",
	rankedleAlreadyVoted: "Du hast bereits für das Überspringen dieses Songs gestimmt",
	rankedleAllHintsUsed: "Alle Hinweise wurden bereits verwendet",
	rankedleLeaderboardEmpty: "Das Leaderboard ist leer",
	rankedleInvalidPage: "Die Seite muss zwischen 1 und",
	rankedleSongError: "Es konnte kein Song gefunden werden, das Spiel wurde beendet",
	rankedleUnexpectedStop: "Ein unerwarteter Fehler ist aufgetreten, das Spiel wurde beendet",

	/**
	 * Rankedle responses
	 */
	rankedleJoined: "Du bist dem Rankedle-Spiel beigetreten",
	rankedleLeft: "Du hast das Rankedle-Spiel verlassen",
	rankedleStopped: "Spiel beendet",
	rankedleJoinedAnnouncement: "ist dem Spiel beigetreten",
	rankedleLeftAnnouncement: "hat das Spiel verlassen",
	rankedleVoteRegistered: "Deine Stimme zum Überspringen wurde registriert",

	/**
	 * Rankedle game
	 */
	rankedleNewGameTitle: "Neues Rankedle-Spiel startet",
	rankedleSecondsToJoin: "Sekunden übrig, um dem Spiel beizutreten!",
	rankedlePointsToWin: "Punkte zum Sieg",
	rankedleGameStartedTitle: "Das Spiel hat begonnen",
	rankedleJoinWithCommand: "Du kannst weiterhin mit /rankedle join beitreten",
	rankedleJoinButton: "Spiel beitreten",
	rankedleVoteskipButton: "Für Skip stimmen",
	rankedlePlayers: "Spieler",
	rankedleNoPlayers: "Keine",
	rankedleRound: "Runde",
	rankedleSearchingSong: "Suche nach einem zufälligen Song",
	rankedleGuessPrompt: "Errate den Namen dieses Songs",
	rankedleTimeLimit: "Zeitlimit",
	rankedleHints: "Hinweise",
	rankedleHintHowTo: "Nutze /rankedle hint für einen zufälligen Hinweis",
	rankedlePoints: "Punkte",
	rankedlePointsShort: "Pkt",
	rankedleSongBy: "von",
	rankedleSongWas: "Der Song war",
	rankedleGuessedIt: "hat es erraten",
	rankedleCorrectTitle: "Richtige Antwort",
	rankedleCurrentScoreTitle: "Aktueller Punktestand",
	rankedleTimeoutTitle: "Zeit abgelaufen",
	rankedleTimeoutDescription: "Niemand hat es erraten",
	rankedleSkippedTitle: "Song übersprungen",
	rankedleSkippedVoteTitle: "Song per Abstimmung übersprungen",
	rankedleAllVotedTitle: "Alle Spieler haben abgestimmt",
	rankedleSkipping: "Song wird übersprungen",
	rankedleInactivityTitle: "Spiel wegen Inaktivität beendet",
	rankedleInactivityDescription: "Während der Runde wurde keine Teilnahme erkannt",
	rankedleGameOverTitle: "Spiel vorbei",
	rankedleFinalResults: "Endergebnis",
	rankedleNoParticipants: "Es gab keine Teilnehmer",
	rankedleStoppedTitle: "Rankedle-Spiel beendet",
	rankedleStoppedByAdmin: "Das Spiel wurde von einem Administrator beendet",
	rankedleEveryoneLeft: "Alle Spieler haben das Spiel verlassen",
	rankedleLeaderboardTitle: "Globales Rankedle-Leaderboard",
	rankedleLeaderboardFull: "Nutze /rankedle leaderboard für die volle Tabelle",
	rankedleEmptyPage: "Keine Spieler auf dieser Seite",

	/**
	 * Rankedle hints
	 */
	rankedleHintTitle: "Hinweis",
	rankedleHintAudio: "Längeres Audio! Höre einen längeren Ausschnitt des Songs",
	rankedleHintUploader: "Mapper Hinweis: der Song wurde hochgeladen von",
	rankedleHintDifficulties: "Schwierigkeits Hinweis: der Song hat folgende Schwierigkeiten",
	rankedleHintCover: "Visueller Hinweis: hier ist das Cover (leicht unscharf)",
	rankedleHintCoverFallback: "Visueller Hinweis: hier ist das Cover",
	rankedleNotRanked: "Nicht ranked",

	/**
	 * Birthday command
	 */
	birthdayDescription: "Geburtstage verwalten",
	birthdayAddDescription: "Speichere deinen Geburtstag",
	birthdayEditDescription: "Ändere deinen Geburtstag",
	birthdayDeleteDescription: "Lösche deinen Geburtstag",
	birthdayBanDescription: "Sperre einen User für die Geburtstag-Befehle",
	birthdayListDescription: "Zeige alle Geburtstage nach Monat gruppiert",
	birthdayRecentDescription: "Zeige die nächsten Geburtstage",
	birthdayDateOptionDescription: "Dein Geburtstag im Format dd-MM-yyyy",
	birthdayUserOptionDescription: "Der zu sperrende User",

	/**
	 * Birthday responses
	 */
	birthdayInvalidFormat: "Ungültiges Datum, nutze das Format dd-MM-yyyy (beispiel: 15-03-1990)",
	birthdayInvalidYear: "Bitte gib ein realistisches Geburtsjahr ein",
	birthdayBanned: "Du bist für die Geburtstag-Befehle gesperrt",
	birthdayAlreadyRegistered: "Du hast bereits einen Geburtstag gespeichert, nutze /birthday edit zum Ändern",
	birthdayNotRegistered: "Du hast noch keinen Geburtstag gespeichert, nutze /birthday add",
	birthdayAdded: "Geburtstag gespeichert",
	birthdayUpdated: "Geburtstag aktualisiert",
	birthdayDeleted: "Dein Geburtstag wurde gelöscht",
	birthdayUserBanned: "wurde für die Geburtstags-Befehle gesperrt",
	birthdayListTitle: "Geburtstagsliste",
	birthdayListEmpty: "Es wurden noch keine Geburtstage gespeichert",
	birthdayRecentTitle: "Nächste Geburtstage",
	birthdayRegisteredCount: "Geburtstage gespeichert",
	birthdayToday: "Heute hat diese Person Geburtstag",
	birthdayAnnouncementTitle: "Alles Gute zum Geburtstag",
	birthdayAnnouncementDescription: "wird",

	/**
	 * TODO: admin commands
	 */

	/**
	 * Misc
	 */
	verificationChannelMessage: "**Gib deinen ScoreSaber Namen oder deine ID ein, um verifiziert zu werden\nDu kannst auch \"besucher\" eingeben, um ohne Konto beizutreten**"
} satisfies LanguageMessages