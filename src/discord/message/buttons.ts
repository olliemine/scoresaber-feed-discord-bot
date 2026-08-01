import { ButtonBuilder } from "discord.js";

export function createButtonWithEmoji(button: ButtonBuilder, emoji: string) {
	if(emoji !== "") button.setEmoji(emoji)

	return button
}
