import config from '../../../config';
import { INote } from '../../../models/note';
import { INoteReaction } from '../../../models/note-reaction';

export const renderLike = (noteReaction: INoteReaction, note: INote) => {
	const reaction = generalMap[noteReaction.reaction] || noteReaction.reaction;
	return {
		type: 'Like',
		id: `${config.url}/likes/${noteReaction._id}`,
		actor: `${config.url}/users/${noteReaction.userId}`,
		object: note.uri ? note.uri : `${config.url}/notes/${noteReaction.noteId}`,
		content: reaction,
		_misskey_reaction: reaction
	};
};

const generalMap: Record<string, string> = {
	'like': '👍',
	'love': '❤',	// ここに記述する場合は異体字セレクタを入れない
	'laugh': '😆',
	'hmm': '🤔',
	'surprise': '😮',
	'congrats': '🎉',
	'angry': '💢',
	'confused': '😥',
	'rip': '😇',
	'pudding': '🍮',
	'star': '⭐',
};
