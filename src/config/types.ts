/**
 * ユーザーが設定する必要のある情報
 */
export type Source = {
	repository_url?: string;
	feedback_url?: string;
	imasHostTokens?: Record<string, string>;
	emergencyDelivers: Record<string, Record<'trigger' | 'head' | 'body', string | RegExp>>;
	url: string;
	port: number;
	https?: { [x: string]: string };
	disableHsts?: boolean;
	mongodb: {
		host: string;
		port: number;
		db: string;
		user: string;
		pass: string;
	};
	redis: {
		host: string;
		port: number;
		pass: string;
		db?: number;
		prefix?: string;
	};
	elasticsearch: {
		host: string;
		port: number;
		pass: string;
	};
	drive?: DriveConfig;
	remoteDrive?: DriveConfig;

	autoAdmin?: boolean;

	proxy?: string;

	proxyProxy?: string;

	accesslog?: string;

	clusterLimit?: number;

	outgoingAddressFamily?: 'ipv4' | 'ipv6' | 'dual';

	deliverJobConcurrency?: number;
	inboxJobConcurrency?: number;
};

export type DriveConfig = {
	storage: string;
	bucket?: string;
	container?: string;
	prefix?: string;
	baseUrl?: string;
	config?: any;
};

/**
 * twistaが自動的に(ユーザーが設定した情報から推論して)設定する情報
 */
export type Mixin = {
	host: string;
	hostname: string;
	scheme: string;
	wsScheme: string;
	apiUrl: string;
	wsUrl: string;
	authUrl: string;
	driveUrl: string;
	userAgent: string;
};

export type Config = Source & Mixin;
