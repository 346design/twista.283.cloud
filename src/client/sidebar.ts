import { faBell, faComments, faLaugh } from '@fortawesome/free-regular-svg-icons';
import { faCloud, faColumns, faDoorClosed, faFileAlt, faGamepad, faHashtag, faListUl, faPaperclip, faPaintBrush, faSatellite, faSatelliteDish, faSearch, faStar, faTerminal, faUserClock, faUsers } from '@fortawesome/free-solid-svg-icons';
import { computed } from 'vue';
import { store } from '@/store';
import * as os from '@/os';
import { i18n } from '@/i18n';

export const sidebarDef = {
	notifications: {
		title: 'notifications',
		icon: faBell,
		show: computed(() => store.getters.isSignedIn),
		indicated: computed(() => store.getters.isSignedIn && store.state.i.hasUnreadNotification),
		to: '/my/notifications',
	},
	messaging: {
		title: 'messaging',
		icon: faComments,
		show: computed(() => store.getters.isSignedIn),
		indicated: computed(() => store.getters.isSignedIn && store.state.i.hasUnreadMessagingMessage),
		to: '/my/messaging',
	},
	drive: {
		title: 'drive',
		icon: faCloud,
		show: computed(() => store.getters.isSignedIn),
		to: '/my/drive',
	},
	followRequests: {
		title: 'followRequests',
		icon: faUserClock,
		show: computed(() => store.getters.isSignedIn && store.state.i.hasPendingReceivedFollowRequest),
		indicated: computed(() => store.getters.isSignedIn && store.state.i.hasPendingReceivedFollowRequest),
		to: '/my/follow-requests',
	},
	explore: {
		title: 'explore',
		icon: faHashtag,
		to: '/explore',
	},
	lists: {
		title: 'lists',
		icon: faListUl,
		show: computed(() => store.getters.isSignedIn),
		to: '/my/lists',
	},
	groups: {
		title: 'groups',
		icon: faUsers,
		show: computed(() => store.getters.isSignedIn),
		to: '/my/groups',
	},
	antennas: {
		title: 'antennas',
		icon: faSatellite,
		show: computed(() => store.getters.isSignedIn),
		to: '/my/antennas',
	},
	favorites: {
		title: 'favorites',
		icon: faStar,
		show: computed(() => store.getters.isSignedIn),
		to: '/my/favorites',
	},
	pages: {
		title: 'pages',
		icon: faFileAlt,
		to: '/pages',
	},
	clips: {
		title: 'clip',
		icon: faPaperclip,
		show: computed(() => store.getters.isSignedIn),
		to: '/my/clips',
	},
	channels: {
		title: 'channel',
		icon: faSatelliteDish,
		to: '/channels',
	},
	games: {
		title: 'games',
		icon: faGamepad,
		to: '/games/reversi',
	},
	scratchpad: {
		title: 'scratchpad',
		icon: faTerminal,
		to: '/scratchpad',
	},
	rooms: {
		title: 'rooms',
		icon: faDoorClosed,
		show: computed(() => store.getters.isSignedIn),
		to: computed(() => `/@${store.state.i.username}/room`),
	},
	ui: {
		title: 'switchUi',
		icon: faColumns,
		action: (ev) => {
			os.modalMenu([{
				text: i18n.global.t('default'),
				action: () => {
					localStorage.setItem('ui', 'default');
					location.reload();
				}
			}, {
				text: i18n.global.t('deck'),
				action: () => {
					localStorage.setItem('ui', 'deck');
					location.reload();
				}
			}, {
				text: i18n.global.t('desktop') + ' (β)',
				action: () => {
					localStorage.setItem('ui', 'desktop');
					location.reload();
				}
			}], ev.currentTarget || ev.target);
		},
	},
	paint: {
		title: 'paint',
		icon: faPaintBrush,
		show: computed(() => store.getters.isSignedIn),
		to: '/paint',
	},
	emojiSuggestion: {
		title: 'emojiSuggestion',
		icon: faLaugh,
		to: '/emoji-suggestion',
	},
};
