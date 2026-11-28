/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/lib/auth/login.mjs
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
import { AuthError } from "../errors.mjs";
import { LEGACY_PREFIX, UNIFI_OS_PREFIX } from "../config.mjs";
import { clearSite, getSite, setSite } from "../session.mjs";

/**
 * @fileoverview Legacy login, ported from unifi-cli's `lib/api/login/login.mjs`:
 * UniFi OS login on `:443` (`POST /api/auth/login`, capturing the session
 * cookie and `x-csrf-token` header) with the legacy fallback on `:8443`
 * (`POST /api/login`, the `unifises` cookie, a `Referer` header). The
 * injected `fetch` replaces axios and the `httpsAgent`; the site-keyed session
 * lives in the library's own instance (see session.mjs). The offline/skip-login
 * cache read becomes fixture replay in the test harness — there is no runtime
 * cache in the library. `process.exit` paths become typed errors.
 */

/**
 * Collects Set-Cookie values from a fetch Response across Node versions.
 * @param {Response} res
 * @returns {string[]}
 */
function setCookies(res) {
	if (typeof res.headers.getSetCookie === "function") return res.headers.getSetCookie();
	const single = res.headers.get("set-cookie");
	return single ? [single] : [];
}

/**
 * Joins Set-Cookie values into a Cookie header value (name=value pairs only).
 * @param {string[]} cookies
 * @returns {string}
 */
function cookieHeader(cookies) {
	return cookies
		.map((cookie) => cookie.split(";")[0].trim())
		.filter(Boolean)
		.join("; ");
}

/**
 * Logs the legacy account in and stores the session for the site. The UniFi OS
 * attempt runs first; on failure the legacy controller attempt runs. Both
 * attempts failing throws AuthError("AUTH_LOGIN_FAILED").
 *
 * @param {string} [siteKey]
 * @param {{ host?: string }} [options] host override (unifi-cli's `host` param)
 * @returns {Promise<{ cookies: string, csrfToken: string|null, loginType: "unifi_os"|"legacy" }>}
 */
export async function login(siteKey, options = {}) {
	const config = context.unifi;
	const legacy = config.credentials?.legacy;
	if (!legacy?.username || legacy.password === null || legacy.password === undefined) {
		throw new AuthError("AUTH_NO_CREDENTIALS", "legacy login requested but no legacy username/password was given to createUnifi");
	}

	const key = siteKey || config.site;
	const state = getSite(key);
	const host = options.host || config.baseUrl;
	const startedAt = Date.now();

	// --- Step 1: UniFi OS login on :443 ---
	const host443 = host.replace(/:\d+$/, ":443");
	const osLoginUrl = `${host443}/api/auth/login`;
	let osError = null;
	try {
		const res = await config.fetch(osLoginUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json",
				"User-Agent": config.userAgent
			},
			body: JSON.stringify({ username: legacy.username, password: legacy.password })
		});
		const cookies = cookieHeader(setCookies(res));
		const csrfToken = res.headers.get("x-csrf-token");
		if (res.ok && cookies) {
			setSite(key, {
				cookies,
				csrfToken: csrfToken ?? null,
				loggedIn: true,
				loginType: "unifi_os",
				apiPrefix: UNIFI_OS_PREFIX
			});
			return { cookies, csrfToken: csrfToken ?? null, loginType: "unifi_os" };
		}
		osError = new AuthError(
			"AUTH_LOGIN_FAILED",
			`UniFi OS login to ${osLoginUrl} answered ${res.status}${cookies ? "" : " with no session cookie"}`
		);
	} catch (err) {
		osError = new AuthError("AUTH_LOGIN_FAILED", `UniFi OS login to ${osLoginUrl} failed: ${err?.message ?? err}`);
	}

	// --- Step 2: legacy controller login on :8443 ---
	const host8443 = host.replace(/:\d+$/, ":8443");
	const legacyLoginUrl = `${host8443}/api/login`;
	try {
		const res = await config.fetch(legacyLoginUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json",
				"User-Agent": config.userAgent,
				"Referer": `${host8443}/login`
			},
			body: JSON.stringify({ username: legacy.username, password: legacy.password })
		});
		const cookies = setCookies(res);
		if (res.ok && cookies.some((cookie) => cookie.toLowerCase().startsWith("unifises"))) {
			const header = cookieHeader(cookies);
			setSite(key, {
				cookies: header,
				csrfToken: res.headers.get("x-csrf-token") ?? null,
				loggedIn: true,
				loginType: "legacy",
				apiPrefix: LEGACY_PREFIX
			});
			return { cookies: header, csrfToken: null, loginType: "legacy" };
		}
		throw new AuthError(
			"AUTH_LOGIN_FAILED",
			`legacy login to ${legacyLoginUrl} answered ${res.status}${cookies.length ? "" : " with no session cookie"}`
		);
	} catch (err) {
		clearSite(key);
		throw new AuthError("AUTH_LOGIN_FAILED", `login failed after ${Date.now() - startedAt}ms total (UniFi OS + legacy attempts)`, {
			attempts: [osError?.message, err?.message].filter(Boolean)
		});
	}
}

/**
 * True when the site has a usable legacy session (cookie present).
 * @param {string} [siteKey]
 * @returns {boolean}
 */
export function hasSession(siteKey) {
	const state = getSite(siteKey || context.unifi.site);
	return Boolean(state.loggedIn && state.cookies);
}
