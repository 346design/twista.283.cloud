<template>
<img v-if="customEmoji" class="fvgwvorwhxigeolkkrcderjzcawqrscl emoji custom" :class="{ normal, avatar, circle }" :src="url" :alt="alt" :title="title"/>
<img v-else-if="!char" class="fvgwvorwhxigeolkkrcderjzcawqrscl emoji custom unknown" :class="{ normal, avatar, circle }" :src="animate ? `${config.url}/assets/emojis/${name}` : `${config.url}/proxy/${name}.png?url=${encodeURIComponent(`${config.url}/assets/emojis/${name}`)}&static=1`" :alt="`:${name}:`" :title="`:${name}:`"/>
<span v-else-if="useOsDefaultEmojis" class="emoji" v-particle:congrats="char === '🎉'">{{ char }}</span>
<img v-else class="fvgwvorwhxigeolkkrcderjzcawqrscl emoji" :src="url" :alt="alt" :title="alt" v-particle:congrats="char === '🎉'"/>
</template>

<script lang="ts">
import Vue from 'vue';
import { lib } from 'emojilib';
import { getStaticImageUrl } from '../../../common/scripts/get-static-image-url';
import { twemojiBase } from '../../../../../misc/twemoji-base';

export default Vue.extend({
	props: {
		name: {
			type: String,
			required: false
		},
		emoji: {
			type: String,
			required: false
		},
		normal: {
			type: Boolean,
			required: false,
			default: false
		},
		customEmojis: {
			required: false,
			default() {
				return [] as string[];
			}
		},
		isReaction: {
			type: Boolean,
			default: false
		},
		config: {
			required: false,
			default() {
				return {};
			}
		},
		animate: {
			type: Boolean,
			required: false,
			default: false
		}
	},

	data() {
		return {
			url: null,
			char: null,
			customEmoji: null
		}
	},

	computed: {
		avatar(): boolean {
			return this.name && this.name.startsWith('@');
		},

		circle(): boolean {
			return this.$store.state.settings.circleIcons;
		},

		alt(): string {
			return this.customEmoji ? `:${this.customEmoji.resolvable || this.customEmoji.name}:` : this.char;
		},

		title(): string {
			return this.customEmoji ? `:${this.customEmoji.name}:` : this.char;
		},

		useOsDefaultEmojis(): boolean {
			return this.$store.state.device.useOsDefaultEmojis && !this.isReaction;
		}
	},

	watch: {
		customEmojis() {
			if (this.name) {
				const customEmoji = this.customEmojis.find(x => x.name == this.name);
				if (customEmoji) {
					this.customEmoji = customEmoji;
					this.url = this.$store.state.device.disableShowingAnimatedImages
						? getStaticImageUrl(customEmoji.url)
						: customEmoji.url;
				}
			}
		},
	},

	created() {
		if (this.name) {
			const customEmoji = this.customEmojis.find(x => x.name == this.name);
			if (customEmoji) {
				this.customEmoji = customEmoji;
				this.url = this.$store.state.device.disableShowingAnimatedImages
					? getStaticImageUrl(customEmoji.url)
					: customEmoji.url;
			} else {
				const emoji = lib[this.name];
				if (emoji) {
					this.char = emoji.char;
				}
			}
		} else {
			this.char = this.emoji;
		}

		if (this.char) {
			let codes = Array.from(this.char).map(x => x.codePointAt(0).toString(16));
			if (!codes.includes('200d')) codes = codes.filter(x => x != 'fe0f');
			codes = codes.filter(x => x && x.length);

			this.url = `${twemojiBase}/2/svg/${codes.join('-')}.svg`;
		}
	},
});
</script>

<style lang="stylus" scoped>
.fvgwvorwhxigeolkkrcderjzcawqrscl
	height 1.25em
	vertical-align -0.25em

	&.custom
		height 2.5em
		vertical-align middle
		transition transform 0.2s ease

		&:hover
			transform scale(1.2)

		&.normal
			height 1.25em
			vertical-align -0.25em

			&:hover
				transform none

		&.avatar
			border-radius 8px
			object-fit cover
			width 2.5em

			&.normal
				width 1.25em

			&.circle
				border-radius 50%

		&.unknown::before
			display inline-block
			margin 12px 0 0
</style>
