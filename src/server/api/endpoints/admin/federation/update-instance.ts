import $ from 'cafy';
import define from '../../../define';
import Instance from '../../../../../models/instance';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,

	params: {
		host: {
			validator: $.str
		},

		isBlocked: {
			validator: $.optional.nullable.bool
		},

		isMuted: {
			validator: $.optional.nullable.bool
		},

		isClosed: {
			validator: $.optional.nullable.bool
		},
	}
};

export default define(meta, async ps => {
	const instance = await Instance.findOne({ host: ps.host });

	if (instance == null) {
		throw new Error('instance not found');
	}

	return await Instance.findOneAndUpdate({ host: ps.host }, {
		$set: {
			isBlocked: !!ps.isBlocked,
			isMuted: !!ps.isMuted,
			isMarkedAsClosed: !!ps.isClosed
		}
	}, { returnNewDocument: true });
});
