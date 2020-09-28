import React from 'react';
import { t } from '../scripts/i18n';

import '../styles/style.scss';
import Shell from './Shell';

export class ErrorBoundary extends React.Component<{}, {hasError: boolean}, any> {
	constructor(props: any) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(err: unknown) {
		return { hasError: true };
	}

	render() {
		if(this.state.hasError) {
			return (
				<Shell>
					<div className="_box _center _error-box">
						<img src="https://xn--931a.moe/assets/error.jpg" alt="error" />
						<p>{ t('error') }</p>
						<a className="primary" href="/">{t('returnHome') }</a>
					</div>
				</Shell>
			);
		}

		return this.props.children;
	}
}