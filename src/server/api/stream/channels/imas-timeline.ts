import autobind from 'autobind-decorator';
import Mute from '../../../../models/mute';
import { pack } from '../../../../models/note';
import shouldIgnoreThisNote from '../../../../misc/should-ignore-this-note';
import Channel from '../channel';
import fetchMeta from '../../../../misc/fetch-meta';
import Blocking from '../../../../models/blocking';

export default class extends Channel {
	public readonly chName = 'imasTimeline';
	public static shouldShare = true;
	public static requireCredential = true;

	private ignoredUserIds: string[] = [];

	@autobind
	public async init(params: any) {
		const meta = await fetchMeta();
		if (meta.disableLocalTimeline && !this.user.isAdmin && !this.user.isModerator) return;

		// Subscribe events
		this.subscriber.on('imasTimeline', this.onNewNote);

		const mute = await Mute.find({ muterId: this.user._id });
		const blocking = await Blocking.find({ blockerId: this.user._id });
		this.ignoredUserIds = [
			...mute.map(x => x.muteeId.toHexString()),
			...blocking.map(x => x.blockeeId.toHexString())
		];
	}

	@autobind
	private async onNewNote(note: any) {
		// リプライなら再pack
		if (note.replyId != null) {
			note.reply = await pack(note.replyId, this.user, {
				detail: true
			});
		}
		// Renoteなら再pack
		if (note.renoteId != null) {
			note.renote = await pack(note.renoteId, this.user, {
				detail: true
			});
		}

		// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
		if (await shouldIgnoreThisNote(note, this.ignoredUserIds)) return;

		this.send('note', note);
	}

	@autobind
	public dispose() {
		// Unsubscribe events
		this.subscriber.off('imasTimeline', this.onNewNote);
	}
}
