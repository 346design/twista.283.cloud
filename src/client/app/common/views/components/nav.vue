<template>
<span class="mk-nav">
	<a :href="aboutUrl">{{ $t('about') }}</a>
	<i>·</i>
	<a :href="repositoryUrl" rel="noopener" target="_blank">{{ $t('repository') }}</a>
	<i>·</i>
	<a :href="feedbackUrl" rel="noopener" target="_blank">{{ $t('feedback') }}</a>
	<i>·</i>
	<a href="/dev">{{ $t('develop') }}</a>
</span>
</template>

<script lang="ts">
import Vue from 'vue';
import i18n from '../../../i18n';
import { lang } from '../../../config';

export default Vue.extend({
	i18n: i18n('common/views/components/nav.vue'),
	data() {
		return {
			aboutUrl: 'https://twista-docs.283.cloud',
			repositoryUrl: 'https://github.com/346design/twista.283.cloud',
			feedbackUrl: 'https://github.com/346design/twista.283.cloud/issues/new'
		}
	}
});
</script>

<style lang="stylus" scoped>
.mk-nav
	> a
		color inherit
	
	> i 
		margin 0 4px
</style>
