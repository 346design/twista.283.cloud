import $ from 'cafy';
import Emoji from '../../../../../models/emoji';
import define from '../../../define';
import ID from '../../../../../misc/cafy-id';
import { detectUrlMine } from '../../../../../misc/detect-url-mine';

export const meta = {
	desc: {
		'ja-JP': 'カスタム絵文字を更新します。'
	},

	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,

	params: {
		id: {
			validator: $.type(ID)
		},

		name: {
			validator: $.str
		},

		url: {
			validator: $.str
		},

		aliases: {
			validator: $.arr($.str)
		},

		contentType: {
			validator: $.optional.nullable.str,
			default: null as string
		}
	}
};

export default define(meta, async (ps) => {
	const emoji = await Emoji.findOne({
		_id: ps.id
	});

	if (emoji == null) throw new Error('emoji not found');

	const contentType = ps.url ?
		ps.contentType || await detectUrlMine(ps.url) :
		emoji.contentType || 'image/png';

	return await Emoji.findOneAndUpdate({ _id: emoji._id }, {
		$set: {
			updatedAt: new Date(),
			name: ps.name,
			aliases: ps.aliases,
			contentType,
			url: ps.url
		}
	}, { returnNewDocument: true });
});
