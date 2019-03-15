import $ from 'cafy';
import * as escapeRegexp from 'escape-regexp';
import User, { pack, validateUsername, IUser, isRemoteUser } from '../../../../models/user';
import define from '../../define';
import { toDbHost } from '../../../../misc/convert-host';
import { updatePerson } from '../../../../remote/activitypub/models/person';

export const meta = {
	desc: {
		'ja-JP': 'ユーザーを検索します。'
	},

	tags: ['users'],

	requireCredential: false,

	params: {
		query: {
			validator: $.str,
			desc: {
				'ja-JP': 'クエリ'
			}
		},

		offset: {
			validator: $.optional.num.min(0),
			default: 0,
			desc: {
				'ja-JP': 'オフセット'
			}
		},

		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10,
			desc: {
				'ja-JP': '取得する数'
			}
		},

		localOnly: {
			validator: $.optional.bool,
			default: false,
			desc: {
				'ja-JP': 'ローカルユーザーのみ検索対象にするか否か'
			}
		},

		detail: {
			validator: $.optional.bool,
			default: true,
			desc: {
				'ja-JP': '詳細なユーザー情報を含めるか否か'
			}
		},
	},

	res: {
		type: 'array',
		items: {
			type: 'User',
		}
	},
};

export default define(meta, async (ps, me) => {
	const isUsername = validateUsername(ps.query.replace('@', ''), !ps.localOnly);
	const isHostname = ps.query.replace('@', '').match(/\./) != null;

	let users: IUser[] = [];

	if (isUsername) {
		users = await User
			.find({
				host: null,
				usernameLower: new RegExp('^' + escapeRegexp(ps.query.replace('@', '').toLowerCase())),
				isSuspended: { $ne: true }
			}, {
				limit: ps.limit,
				skip: ps.offset
			});

		if (users.length < ps.limit && !ps.localOnly) {
			const otherUsers = await User
				.find({
					host: { $ne: null },
					usernameLower: new RegExp('^' + escapeRegexp(ps.query.replace('@', '').toLowerCase())),
					isSuspended: { $ne: true }
				}, {
					limit: ps.limit - users.length
				});

			users = users.concat(otherUsers);
		}
	} else if (isHostname) {
		users = await User
		.find({
			host: toDbHost(ps.query.replace('@', '')),
			isSuspended: { $ne: true }
		}, {
			limit: ps.limit - users.length
		});
	}

	// ついでにバックグラウンドでリモートユーザー情報を更新しておく
	updateUsers(users);

	return await Promise.all(users.map(user => pack(user, me, { detail: ps.detail })));
});

async function updateUsers(users: IUser[]) {
	for (const user of users) {
		if (isRemoteUser(user)) {
			if (user.lastFetchedAt == null || Date.now() - user.lastFetchedAt.getTime() > 1000 * 60 * 60 * 24) {
				console.log(`updating ${user.uri}`);
				await updatePerson(user.uri).catch(() => {});
			}
		}
	}
}
