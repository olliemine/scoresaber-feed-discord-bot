export namespace LevelDifficulties {
	export type FullName = "Easy" | "Normal" | "Hard" | "Expert" | "ExpertPlus"
	export type FullNameFormated = "Easy" | "Normal" | "Hard" | "Expert" | "Expert+"
	export type SmallerName = "E" | "N" | "H" | "EX" | "EX+"
	export type SmallestName = "E" | "N" | "H" | "EX" | "E+"
	export type Number = 1 | 3 | 5 | 7 | 9
	export const Array: {
		FullName: LevelDifficulties.FullName,
		FullNameFormated: LevelDifficulties.FullNameFormated,
		SmallerName: LevelDifficulties.SmallerName,
		SmallestName: LevelDifficulties.SmallestName,
		Number: LevelDifficulties.Number
	}[] = [{
		FullName: "Easy",
		FullNameFormated: "Easy",
		SmallerName: "E",
		SmallestName: "E",
		Number: 1
	}, {
		FullName: "Normal",
		FullNameFormated: "Normal",
		SmallerName: "N",
		SmallestName: "N",
		Number: 3
	}, {
		FullName: "Hard",
		FullNameFormated: "Hard",
		SmallerName: "H",
		SmallestName: "H",
		Number: 5
	}, {
		FullName: "Expert",
		FullNameFormated: "Expert",
		SmallerName: "EX",
		SmallestName: "EX",
		Number: 7
	}, {
		FullName: "ExpertPlus",
		FullNameFormated: "Expert+",
		SmallerName: "EX+",
		SmallestName: "E+",
		Number: 9
	}]
}

export const MAP_TAGS = {
	"tech" : "Tech",
	"dance-style" : "Dance Style",
	"balanced" : "Balanced",
	"challenge" : "Challenge",
	"accuracy" : "Accuracy",
	"fitness" : "Fitness",
	
	"swing" : "Swing",
	"nightcore" : "Nightcore",
	"folk-acoustic" : "Folk & Acoustic",
	"kids-family" : "Kids & Family",
	"ambient" : "Ambient",
	"funk-disco" : "Funk & Disco",
	"jazz" : "Jazz",
	"classical-orchestral" : "Classical & Ochestral",
	"soul" : "Soul",
	"speedcore" : "Speedcore",
	"punk" : "Punk",
	"rb" : "R&B",
	"holiday" : "Holiday",
	"vocaloid" : "Voicaloid",
	"j-rock" : "J-Rock",
	"trance" : "Trance",
	"drum-and-bass" : "Drum and Bass",
	"comedy-meme" : "Comedy & Meme",
	"instrumental" : "Instrumental",
	"hardcore" : "Hardcore",
	"k-pop" : "K-Pop",
	"indie" : "Indie",
	"techno" : "Techno",
	"house" : "House",
	"video-game-soundtrack" : "Video Game",
	"tv-movie-soundtrack" : "TV & Film",
	"alternative" : "Alternative",
	"dubstep" : "Dubstep",
	"metal" : "Metal",
	"anime" : "Anime",
	"hip-hop-rap" : "Hip Hop & Rap",
	"j-pop" : "J-Pop",
	"dance" : "Dance",
	"rock" : "Rock",
	"pop" : "Pop",
	"electronic" : "Electronic"
}