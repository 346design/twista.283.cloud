import * as mongo from 'mongodb';
import * as promiseLimit from 'promise-limit';
import { toUnicode } from 'punycode';

import config from '../../../config';
import User, { validateUsername, isValidName, IUser, IRemoteUser, isRemoteUser } from '../../../models/user';
import Resolver from '../resolver';
import { resolveImage } from './image';
import { isCollectionOrOrderedCollection, isCollection, IActor, IObject, validActor, actorIsBot, isOrderedCollection, isPerson, isPropertyValue, IApPropertyValue } from '../type';
import { IDriveFile } from '../../../models/drive-file';
import Meta from '../../../models/meta';
import fetchMeta from '../../../misc/fetch-meta';
import { fromHtml } from '../../../mfm/fromHtml';
import usersChart from '../../../services/chart/users';
import instanceChart from '../../../services/chart/instance';
import { URL } from 'url';
import { resolveNote, extractEmojis } from './note';
import { registerOrFetchInstanceDoc } from '../../../services/register-or-fetch-instance-doc';
import Instance from '../../../models/instance';
import getDriveFileUrl from '../../../misc/get-drive-file-url';
import { IEmoji } from '../../../models/emoji';
import { extractHashtags } from './tag';
import Following from '../../../models/following';
import { apLogger } from '../logger';
import { INote } from '../../../models/note';
import { updateHashtag } from '../../../services/update-hashtag';
import FollowRequest from '../../../models/follow-request';
import { toArray, toSingle } from '../../../prelude/array';
import { tryCreateUrl } from '../../../prelude/url';
import AbuseUserReport from '../../../models/abuse-user-report';
import { publishAdminStream } from '../../../services/stream';
const logger = apLogger;

/**
 * Validate and convert to actor object
 * @param x Fetched object
 * @param uri Fetch target URI
 */
function toPerson(x: IObject, uri: string): IActor {
	const expectHostUrl = tryCreateUrl(uri, URL);
	const expectHost = expectHostUrl && toUnicode(expectHostUrl.hostname.toLowerCase());

	if (x == null) {
		throw new Error('invalid person: object is null');
	}

	if (!validActor.includes(x.type)) {
		return new Error(`invalid actor: '${x.type}' is not a valid actor`);
	}

	if (typeof x.preferredUsername !== 'string') {
		throw new Error('invalid person: preferredUsername is not a string');
	}

	if (typeof x.inbox !== 'string') {
		throw new Error('invalid person: inbox is not a string');
	}

	if (!validateUsername(x.preferredUsername, true)) {
		throw new Error('invalid person: invalid username');
	}

	if (!isValidName(x.name == '' ? null : x.name)) {
		throw new Error('invalid person: invalid name');
	}

	if (typeof x.id !== 'string') {
		throw new Error('invalid person: id is not a string');
	}

	const idHostUrl = tryCreateUrl(x.id, URL);
	const idHost = idHostUrl && toUnicode(idHostUrl.hostname.toLowerCase());
	if (idHostUrl && idHost !== expectHost) {
		throw new Error('invalid person: id has different host');
	}

	if (typeof x.publicKey.id !== 'string') {
		throw new Error('invalid person: publicKey.id is not a string');
	}

	const publicKeyIdHostUrl = tryCreateUrl(x.publicKey.id, URL);
	const publicKeyIdHost = publicKeyIdHostUrl && toUnicode(publicKeyIdHostUrl.hostname.toLowerCase());
	if (publicKeyIdHostUrl && publicKeyIdHost !== expectHost) {
		throw new Error('invalid person: publicKey.id has different host');
	}

	return x;
}

/**
 * Personをフェッチします。
 *
 * twistaに対象のPersonが登録されていればそれを返します。
 */
export async function fetchPerson(uri: string, resolver?: Resolver): Promise<IUser> {
	if (typeof uri !== 'string') throw 'uri is not string';

	// URIがこのサーバーを指しているならデータベースからフェッチ
	if (uri.startsWith(config.url + '/')) {
		const id = new mongo.ObjectID(uri.split('/').pop());
		return await User.findOne({ _id: id });
	}

	//#region このサーバーに既に登録されていたらそれを返す
	const exist = await User.findOne({ uri });

	if (exist) {
		return exist;
	}
	//#endregion

	return null;
}

/**
 * Personを作成します。
 */
export async function createPerson(uri: string, resolver?: Resolver): Promise<IUser> {
	if (typeof uri !== 'string') throw 'uri is not string';

	if (!resolver) resolver = new Resolver();

	return await createPersonFromObject(uri, await resolver.resolve(uri), resolver);
}

export async function createPersonFromObject(uri: string, object: IObject, resolver?: Resolver) {
	if (!resolver) resolver = new Resolver();

	const person = toPerson(object, uri);

	logger.info(`Creating the actor: ${person.id}`);

	const [followersCount = 0, followingCount = 0, notesCount = 0] = await Promise.all([
		resolver.resolve(person.followers).then(
			resolved => isCollectionOrOrderedCollection(resolved) ? resolved.totalItems : undefined,
			() => undefined
		),
		resolver.resolve(person.following).then(
			resolved => isCollectionOrOrderedCollection(resolved) ? resolved.totalItems : undefined,
			() => undefined
		),
		resolver.resolve(person.outbox).then(
			resolved => isCollectionOrOrderedCollection(resolved) ? resolved.totalItems : undefined,
			() => undefined
		)
	]);

	const host = toUnicode(tryCreateUrl(person.id, URL).hostname.toLowerCase());

	const { fields, services } = analyzeAttachments(person.attachment);

	const tags = extractHashtags(person.tag).map(tag => tag.toLowerCase());

	const is = validActor.reduce<Record<string, boolean>>((a, c) => (a[`is${c}`] = person.type == c, a), {});

	const description = fromHtml(person.summary);

	fetchMeta().then(({ spamBioRegExp }) => {
		if (spamBioRegExp && new RegExp(spamBioRegExp).test(description)) {
			AbuseUserReport.insert({
				createdAt: new Date(),
				userId: user._id,
				comment: `${description} matches /${spamBioRegExp}/`
			}).then(report => User.find({
				$or: [
					{ isAdmin: true },
					{ isModerator: true }
				]
			}).then(moderators => {
				for (const moderator of moderators) {
					publishAdminStream(moderator._id, 'newAbuseUserReport', {
						id: report._id,
						userId: report.userId,
						comment: report.comment
					});
				}
			}));
		}
	});

	// Create user
	let user: IRemoteUser;
	try {
		user = await User.insert({
			avatarId: null,
			bannerId: null,
			createdAt: new Date(),
			lastFetchedAt: new Date(),
			description,
			followersCount,
			followingCount,
			notesCount,
			name: person.name,
			isLocked: person.manuallyApprovesFollowers,
			username: person.preferredUsername,
			usernameLower: person.preferredUsername.toLowerCase(),
			host,
			publicKey: {
				id: person.publicKey.id,
				publicKeyPem: person.publicKey.publicKeyPem
			},
			inbox: person.inbox,
			sharedInbox: person.sharedInbox || (person.endpoints ? person.endpoints.sharedInbox : undefined),
			outbox: person.outbox,
			featured: person.featured,
			endpoints: person.endpoints,
			uri: person.id,
			url: person.url,
			fields,
			...services,
			tags,
			...is,
			isBot: actorIsBot[person.type],
			isCat: (person as any).isCat === true,
			isKaho: (person as any).isKaho === true,
			avatarAngle: (person as any).avatarAngle
		});
	} catch (e) {
		// duplicate key error
		if (e.code === 11000) {
			throw new Error(`Person already registered: ${person.preferredUsername}@${host} (${uri})`);
		}

		logger.error(e);
		throw e;
	}

	// Register host
	registerOrFetchInstanceDoc(host).then(i => {
		Instance.update({ _id: i._id }, {
			$inc: {
				usersCount: 1
			}
		});

		instanceChart.newUser(i.host);
	});

	//#region Increment users count
	Meta.update({}, {
		$inc: {
			'stats.usersCount': 1
		}
	}, { upsert: true });

	usersChart.update(user, true);
	//#endregion

	// ハッシュタグ更新
	for (const tag of tags) updateHashtag(user, tag, true, true);
	for (const tag of (user.tags || []).filter(x => !tags.includes(x))) updateHashtag(user, tag, true, false);

	//#region アイコンとヘッダー画像をフェッチ
	const [avatar, banner] = (await Promise.all<IDriveFile>([
		toSingle(person.icon),
		toSingle(person.image)
	].map(img =>
		img == null
			? Promise.resolve(null)
			: resolveImage(user, img).catch(() => null)
	)));

	const avatarId = avatar ? avatar._id : null;
	const bannerId = banner ? banner._id : null;
	const avatarUrl = getDriveFileUrl(avatar, true);
	const bannerUrl = getDriveFileUrl(banner, false);
	const avatarColor = avatar && avatar.metadata.properties.avgColor ? avatar.metadata.properties.avgColor : null;
	const bannerColor = banner && avatar.metadata.properties.avgColor ? banner.metadata.properties.avgColor : null;

	await User.update({ _id: user._id }, {
		$set: {
			avatarId,
			bannerId,
			avatarUrl,
			bannerUrl,
			avatarColor,
			bannerColor
		}
	});

	user.avatarId = avatarId;
	user.bannerId = bannerId;
	user.avatarUrl = avatarUrl;
	user.bannerUrl = bannerUrl;
	user.avatarColor = avatarColor;
	user.bannerColor = bannerColor;
	//#endregion

	//#region カスタム絵文字取得
	const emojis = await extractEmojis(person.tag, host).catch(e => {
		logger.info(`extractEmojis: ${e}`);
		return [] as IEmoji[];
	});

	const emojiNames = emojis.map(emoji => emoji.name);

	await User.update({ _id: user._id }, {
		$set: {
			emojis: emojiNames
		}
	});
	//#endregion

	await updateFeatured(user._id).catch(err => logger.error(err));

	return user;
}

/**
 * Personの情報を更新します。
 * twistaに対象のPersonが登録されていなければ無視します。
 * @param uri URI of IActor
 * @param resolver Resolver
 * @param hint Hint of IActor object (この値が正当なPersonの場合、Remote resolveをせずに更新に利用します)
 */
export async function updatePerson(uri: string, resolver?: Resolver, hint?: IApPerson): Promise<void> {
	if (typeof uri !== 'string') throw 'uri is not string';

	// URIがこのサーバーを指しているならスキップ
	if (uri.startsWith(config.url + '/')) {
		return;
	}

	//#region このサーバーに既に登録されているか
	const exist = await User.findOne({ uri }) as IRemoteUser;

	if (exist == null) {
		return;
	}
	//#endregion

	if (resolver == null) resolver = new Resolver();

	const object = hint || await resolver.resolve(uri) as any;

	const person = toPerson(object, uri);

	logger.info(`Updating the IActor: ${person.id}`);

	const [followersCount = 0, followingCount = 0, notesCount = 0] = await Promise.all([
		resolver.resolve(person.followers).then(
			resolved => isCollectionOrOrderedCollection(resolved) ? resolved.totalItems : undefined,
			() => undefined
		),
		resolver.resolve(person.following).then(
			resolved => isCollectionOrOrderedCollection(resolved) ? resolved.totalItems : undefined,
			() => undefined
		),
		resolver.resolve(person.outbox).then(
			resolved => isCollectionOrOrderedCollection(resolved) ? resolved.totalItems : undefined,
			() => undefined
		)
	]);

	// アイコンとヘッダー画像をフェッチ
	const [avatar, banner] = (await Promise.all<IDriveFile>([
		toSingle(person.icon),
		toSingle(person.image)
	].map(img =>
		img == null
			? Promise.resolve(null)
			: resolveImage(exist, img).catch(() => null)
	)));

	// カスタム絵文字取得
	const emojis = await extractEmojis(person.tag, exist.host).catch(e => {
		logger.info(`extractEmojis: ${e}`);
		return [] as IEmoji[];
	});

	const emojiNames = emojis.map(emoji => emoji.name);

	const { fields, services } = analyzeAttachments(person.attachment);

	const tags = extractHashtags(person.tag).map(tag => tag.toLowerCase());

	const description = fromHtml(person.summary);

	fetchMeta().then(({ spamBioRegExp }) => {
		if (spamBioRegExp && new RegExp(spamBioRegExp).test(description)) {
			AbuseUserReport.insert({
				createdAt: new Date(),
				userId: exist._id,
				comment: `${description} matches /${spamBioRegExp}/`
			}).then(report => User.find({
				$or: [
					{ isAdmin: true },
					{ isModerator: true }
				]
			}).then(moderators => {
				for (const moderator of moderators) {
					publishAdminStream(moderator._id, 'newAbuseUserReport', {
						id: report._id,
						userId: report.userId,
						comment: report.comment
					});
				}
			}));
		}
	});

	const updates = {
		lastFetchedAt: new Date(),
		inbox: person.inbox,
		sharedInbox: person.sharedInbox || (person.endpoints ? person.endpoints.sharedInbox : undefined),
		outbox: person.outbox,
		featured: person.featured,
		emojis: emojiNames,
		description,
		followersCount,
		followingCount,
		notesCount,
		name: person.name,
		url: person.url,
		endpoints: person.endpoints,
		fields,
		...services,
		tags,
		isBot: actorIsBot[person.type],
		isCat: (person as any).isCat === true,
		isKaho: (person as any).isKaho === true,
		isLocked: person.manuallyApprovesFollowers,
		publicKey: {
			id: person.publicKey.id,
			publicKeyPem: person.publicKey.publicKeyPem
		},
	} as any;

	if (avatar) {
		updates.avatarId = avatar._id;
		updates.avatarUrl = getDriveFileUrl(avatar, true);
		updates.avatarColor = avatar.metadata.properties.avgColor ? avatar.metadata.properties.avgColor : null;
	}

	if (banner) {
		updates.bannerId = banner._id;
		updates.bannerUrl = getDriveFileUrl(banner, true);
		updates.bannerColor = banner.metadata.properties.avgColor ? banner.metadata.properties.avgColor : null;
	}

	// Update user
	await User.update({ _id: exist._id }, {
		$set: updates
	});

	// ハッシュタグ更新
	for (const tag of tags) updateHashtag(exist, tag, true, true);
	for (const tag of (exist.tags || []).filter(x => !tags.includes(x))) updateHashtag(exist, tag, true, false);

	// 該当ユーザーが既にフォロワーになっていた場合はFollowingもアップデートする
	await Following.update({
		followerId: exist._id
	}, {
		$set: {
			'_follower.sharedInbox': person.sharedInbox || (person.endpoints ? person.endpoints.sharedInbox : undefined)
		}
	}, {
		multi: true
	});

	await updateFeatured(exist._id).catch(err => logger.error(err));

	fetchOutbox(exist._id).catch(err => logger.warn(err));
}

/**
 * Personを解決します。
 *
 * twistaに対象のPersonが登録されていればそれを返し、そうでなければ
 * リモートサーバーからフェッチしてtwistaに登録しそれを返します。
 */
export async function resolvePerson(uri: string, verifier?: string, resolver?: Resolver): Promise<IUser> {
	if (typeof uri !== 'string') throw 'uri is not string';

	//#region このサーバーに既に登録されていたらそれを返す
	const exist = await fetchPerson(uri);

	if (exist) {
		return exist;
	}
	//#endregion

	// リモートサーバーからフェッチしてきて登録
	if (resolver == null) resolver = new Resolver();
	return await createPerson(uri, resolver);
}

const services: {
		[x: string]: (id: string, username: string) => any
	} = {
	'misskey:authentication:twitter': (userId, screenName) => ({ userId, screenName }),
	'misskey:authentication:github': (id, login) => ({ id, login }),
	'misskey:authentication:discord': (id, name) => $discord(id, name)
};

const $discord = (id: string, name: string) => {
	if (typeof name !== 'string')
		name = 'unknown#0000';
	const [username, discriminator] = name.split('#');
	return { id, username, discriminator };
};

function addService(target: { [x: string]: any }, source: IApPropertyValue) {
	const service = services[source.name];

	if (typeof source.value !== 'string')
		source.value = 'unknown';

	const [id, username] = source.value.split('@');

	if (service)
		target[source.name.split(':')[2]] = service(id, username);
}

export function analyzeAttachments(attachments: IObject | IObject[] | undefined) {
	attachments = toArray(attachments);

	const fields: {
		name: string,
		value: string
	}[] = [];

	const services: { [x: string]: any } = {};

	for (const attachment of attachments.filter(isPropertyValue)) {
		if (isPropertyValue(attachment.identifier)) {
			addService(services, attachment.identifier);
		} else {
			fields.push({
				name: attachment.name,
				value: fromHtml(attachment.value)
			});
		}
	}

	return { fields, services };
}

export async function updateFeatured(userId: mongo.ObjectID) {
	const user = await User.findOne({ _id: userId });
	if (!isRemoteUser(user)) return;
	if (!user.featured) return;

	logger.info(`Updating the featured: ${user.uri}`);

	const resolver = new Resolver();

	// Resolve to (Ordered)Collection Object
	const collection = await resolver.resolveCollection(user.featured);
	if (!isCollectionOrOrderedCollection(collection)) throw new Error(`Object is not Collection or OrderedCollection`);

	// Resolve to Object(may be Note) arrays
	const unresolvedItems = isCollection(collection) ? collection.items : collection.orderedItems;
	const items = await resolver.resolve(unresolvedItems);
	if (!Array.isArray(items)) throw new Error(`Collection items is not an array`);

	// Resolve and regist Notes
	const limit = promiseLimit(2);
	const featuredNotes = await Promise.all(items
		.filter(item => item.type === 'Note')
		.slice(0, 5)
		.map(item => limit(() => resolveNote(item, resolver, true)) as Promise<INote>));

	await User.update({ _id: user._id }, {
		$set: {
			pinnedNoteIds: featuredNotes.filter(note => note != null).map(note => note._id)
		}
	});
}

export async function fetchOutbox(userId: mongo.ObjectID, force = false) {
	const user = await User.findOne({ _id: userId });
	if (!isRemoteUser(user)) return;
	if (!user.outbox) {
		logger.debug(`no outbox: ${userId}`);
		return;
	}

	if (!force) {
		// フォロワーもリクエストもない場合はfetchしない
		const followerExists = await Following.findOne({
			followeeId: userId
		});

		if (followerExists == null) {
			const requestExists = await FollowRequest.findOne({
				followeeId: userId
			});

			if (requestExists == null) {
				logger.debug(`no follower/request: ${userId}`);
				return;
			}
		}
	}

	logger.info(`Updating the outbox: ${user.outbox}`);

	const resolver = new Resolver();

	// Resolve to OrderedCollection Object
	const collection = await resolver.resolveCollection(user.outbox);
	if (!isOrderedCollection(collection)) throw new Error(`Object is not OrderedCollection`);

	// Get first page items
	let unresolvedItems;

	if (collection.orderedItems) {
		unresolvedItems = collection.orderedItems;
	} else if (collection.first) {
		const page = await resolver.resolveCollection(collection.first);
		unresolvedItems = page.orderedItems;
	} else {
		throw new Error('');
	}

	// Resolve to Activity arrays
	const items = await resolver.resolve(unresolvedItems);
	if (!Array.isArray(items)) throw new Error(`Collection items is not an array`);

	for (const activity of items.reverse()) {	// なるべく古い順に登録する
		if (activity.type === 'Create' && activity.object && activity.object.type === 'Note') {
			// Note
			if (activity.object.inReplyTo) {
				// Note[Replay]
			} else {
				// Note[Original]
				await resolveNote(activity.object, resolver, true);
			}
		} else if (activity.type === 'Announce') {
			// Renote
			// Renoteを追うと終わらないので・・・
			// await resolveNote(activity.object, resolver);
		}
	}
}
