import Note, { INote } from '../../models/note';
import User, { IUser, isLocalUser, isRemoteUser, ILocalUser } from '../../models/user';
import { publishNoteStream } from '../stream';
import renderDelete from '../../remote/activitypub/renderer/delete';
import renderUndo from '../../remote/activitypub/renderer/undo';
import { renderActivity } from '../../remote/activitypub/renderer';
import { deliver } from '../../queue';
import Following from '../../models/following';
import renderTombstone from '../../remote/activitypub/renderer/tombstone';
import renderAnnounce from '../../remote/activitypub/renderer/announce';
import notesChart from '../../services/chart/notes';
import perUserNotesChart from '../../services/chart/per-user-notes';
import config from '../../config';
import { containerMap, droppedndexVersion } from '../../misc/mecab';
import NoteUnread from '../../models/note-unread';
import read from './read';
import DriveFile from '../../models/drive-file';
import { registerOrFetchInstanceDoc } from '../register-or-fetch-instance-doc';
import Instance from '../../models/instance';
import instanceChart from '../../services/chart/instance';
import Favorite from '../../models/favorite';
/*
import { imasHosts } from './create';
*/

/**
 * 投稿を削除します。
 * @param user 投稿者
 * @param note 投稿
 */
export default async function(user: IUser, note: INote, quiet = false) {
	const deletedAt = new Date();

	await Note.update({
		_id: note._id,
		userId: user._id
	}, {
		$set: {
			deletedAt,
			mecabIndexVersion: droppedndexVersion,
			...(Object.values(containerMap).reduce<Record<string, string[]>>((a, c) => (a[`mecabIndex.${c}`] = [], a), {})),
			text: null,
			tags: [],
			fileIds: [],
			renoteId: null,
			poll: null,
			geo: null,
			cw: null
		}
	});

	if (note.renoteId) {
		Note.update({ _id: note.renoteId }, {
			$inc: {
				renoteCount: -1,
				score: -1
			},
			$pull: {
				_quoteIds: note._id
			}
		});
	}

	// この投稿が関わる未読通知を削除
	NoteUnread.find({
		noteId: note._id
	}).then(unreads => {
		for (const unread of unreads) {
			read(unread.userId, unread.noteId);
		}
	});

	// この投稿をお気に入りから削除
	Favorite.remove({
		noteId: note._id
	});

	// ファイルが添付されていた場合ドライブのファイルの「このファイルが添付された投稿一覧」プロパティからこの投稿を削除
	if (note.fileIds) {
		for (const fileId of note.fileIds) {
			DriveFile.update({ _id: fileId }, {
				$pull: {
					'metadata.attachedNoteIds': note._id
				}
			});
		}
	}

	if (!quiet) {
		publishNoteStream(note._id, 'deleted', {
			deletedAt: deletedAt
		});

		// renote解除の場合は、renote解除されたnoteに向けてunrenoted
		if (note.renoteId) {
			publishNoteStream(note.renoteId, 'unrenoted', {
				renoteeId: user._id	// renote解除した人
			});
		}

		//#region ローカルの投稿なら削除アクティビティを配送
		if (isLocalUser(user)) {
			let renote: INote;

			if (note.renoteId && note.text == null && note.poll == null && (note.fileIds == null || note.fileIds.length == 0)) {
				renote = await Note.findOne({
					_id: note.renoteId
				});
			}

			const content = renderActivity(renote ?
				renderUndo(renderAnnounce(renote.uri || `${config.url}/notes/${renote._id}`, note), user) :
				renderDelete(renderTombstone(`${config.url}/notes/${note._id}`), user));

			const everyone: ILocalUser = await User.findOne({
				usernameLower: 'everyone',
				host: null
			});

			if (everyone) {
				const overwriter = {
					userId: everyone._id,
					isEveryone: true
				};
				const content = renderActivity(renderUndo(renderAnnounce(note.uri || `${config.url}/notes/${note._id}`, { ...note, ...overwriter }), everyone));

				const followings = await Following.find({
					followeeId: everyone._id,
					'_follower.host': { $ne: null }
				});

				for (const following of followings) {
					deliver(everyone, content, following._follower.inbox);
				}
			}

			const followings = await Following.find({
				followeeId: user._id,
				'_follower.host': { $ne: null }
			});

/*
			for (const imasHost of imasHosts) {
				deliver(user, content, `https://${imasHost}/inbox`);
			}
*/

			for (const following of followings) {
				deliver(user, content, following._follower.inbox);
			}
		}
		//#endregion

		// 統計を更新
		notesChart.update(note, false);
		perUserNotesChart.update(user, note, false);

		if (isRemoteUser(user)) {
			registerOrFetchInstanceDoc(user.host).then(i => {
				Instance.update({ _id: i._id }, {
					$inc: {
						notesCount: -1
					}
				});

				instanceChart.updateNote(i.host, false);
			});
		}
	}
}
