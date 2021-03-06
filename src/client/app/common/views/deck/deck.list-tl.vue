<template>
<x-notes ref="timeline" :make-promise="makePromise" @inited="() => $emit('loaded')"/>
</template>

<script lang="ts">
import Vue from 'vue';
import XNotes from './deck.notes.vue';

const fetchLimit = 10;

export default Vue.extend({
	components: {
		XNotes
	},

	props: {
		list: {
			type: Object,
			required: true
		},
		mediaOnly: {
			type: Boolean,
			required: false,
			default: false
		},
		sfwMediaOnly: {
			type: Boolean,
			required: false,
			default: false
		},
		nsfwMediaOnly: {
			type: Boolean,
			required: false,
			default: false
		},
	},

	data() {
		return {
			connection: null,
			makePromise: cursor => this.$root.api('notes/user-list-timeline', {
				listId: this.list.id,
				limit: fetchLimit + 1,
				untilId: cursor ? cursor : undefined,
				withFiles: this.mediaOnly,
				fileType: (this.sfwMediaOnly || this.nsfwMediaOnly) ? ['image/jpeg','image/png','image/gif','video/mp4'] : undefined,
				excludeNsfw: this.sfwMediaOnly,
				excludeSfw: this.nsfwMediaOnly,
				includeMyRenotes: this.$store.state.settings.showMyRenotes,
				includeRenotedMyNotes: this.$store.state.settings.showRenotedMyNotes,
				includeLocalRenotes: this.$store.state.settings.showLocalRenotes
			}).then(notes => {
				if (notes.length == fetchLimit + 1) {
					notes.pop();
					return {
						notes: notes,
						cursor: notes[notes.length - 1].id
					};
				} else {
					return {
						notes: notes,
						cursor: null
					};
				}
			})
		};
	},

	watch: {
		mediaOnly() {
			this.$refs.timeline.reload();
		},
		sfwMediaOnly() {
			(this.$refs.timeline as any).reload();
		},
		nsfwMediaOnly() {
			(this.$refs.timeline as any).reload();
		},
	},

	mounted() {
		if (this.connection) this.connection.dispose();
		this.connection = this.$root.stream.connectToChannel('userList', {
			listId: this.list.id
		});
		this.connection.on('note', this.onNote);
		this.connection.on('userAdded', this.onUserAdded);
		this.connection.on('userRemoved', this.onUserRemoved);
	},

	beforeDestroy() {
		this.connection.dispose();
	},

	methods: {
		onNote(note) {
			if (this.mediaOnly && note.files.length == 0) return;
			if (this.sfwMediaOnly && (note.files.length == 0 || note.files.some((x: any) => x.isSensitive))) return;
			if (this.nsfwMediaOnly && (note.files.length == 0 || note.files.every((x: any) => !x.isSensitive))) return;
			(this.$refs.timeline as any).prepend(note);
		},

		onUserAdded() {
			this.$refs.timeline.reload();
		},

		onUserRemoved() {
			this.$refs.timeline.reload();
		},

		focus() {
			this.$refs.timeline.focus();
		}
	}
});
</script>
