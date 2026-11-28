/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/lib/sites.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1764329220)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:07:00-07:00 (1764329220)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { context } from "@cldmv/slothlet/runtime";
import { LEGACY_PREFIX, UNIFI_OS_PREFIX } from "./config.mjs";
import { getSite } from "./session.mjs";

/**
 * @fileoverview The site/host/prefix model, ported from unifi-cli's
 * `lib/api/config/config.mjs` (`getSiteData`, `mergeSite`). The config-file
 * and CLI-argument loading is CLI-specific and stays with unifi-cli — the
 * factory takes the same data as an object, and it reaches this module through
 * the library instance's context (`context.unifi`, set by `createUnifi`).
 *
 * unifi-cli's `siteWeights` ordering and masked printing are presentation
 * concerns of the CLI and are not ported.
 */

/**
 * Resolves one site's effective data from the factory config plus the
 * instance's session state.
 *
 * @param {string} [siteKey] defaults to the configured site
 * @returns {{
 *   site: string, host: string, host_url: string,
 *   api: { prefix: string, cookies: string|null, csrfToken: string|null, loggedIn: boolean,
 *          endpointType: string|null, endpointVersion: string|null, loginType: string|null },
 *   credentials: object, fetch: typeof fetch, timeoutMs: number, loginTimeoutMs: number,
 *   officialBase: string, userAgent: string
 * }}
 */
export function getSiteData(siteKey) {
	const config = context.unifi;
	const key = siteKey || config.site;
	const state = getSite(key);

	const host = config.baseUrl.replace(/^https?:\/\//i, "");
	const hostUrl = config.baseUrl;

	return {
		site: key,
		host,
		host_url: hostUrl,
		api: {
			prefix: state.apiPrefix ?? (state.loginType === "legacy" ? LEGACY_PREFIX : UNIFI_OS_PREFIX),
			cookies: state.cookies,
			csrfToken: state.csrfToken,
			loggedIn: state.loggedIn,
			endpointType: state.endpointType,
			endpointVersion: state.endpointVersion,
			loginType: state.loginType
		},
		credentials: config.credentials,
		fetch: config.fetch,
		timeoutMs: config.timeoutMs,
		loginTimeoutMs: config.loginTimeoutMs,
		officialBase: config.officialBase,
		userAgent: config.userAgent
	};
}

/**
 * The site key a call should operate on.
 * @param {string|undefined} siteKey
 * @returns {string}
 */
export function siteKeyFor(siteKey) {
	return siteKey || context.unifi.site;
}
