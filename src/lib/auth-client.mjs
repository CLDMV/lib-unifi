/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/auth-client.mjs
 *	@Date: 2026-11-28T05:20:00-08:00 (1795872000)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T06:10:32-08:00 (1795875032)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { ApiError, AuthError, CapabilityError, TransportError } from "./errors.mjs";
import { LEGACY_PREFIX, UNIFI_OS_PREFIX } from "./config.mjs";
import { recordError } from "./session.mjs";
import { resolveUrl } from "./url.mjs";

/**
 * @fileoverview The auth transports — where the credentials live. The factory
 * (`createUnifi`) calls `createLegacyAuth` and `createOfficialTransport` once
 * per composed instance; the API key and the legacy account's username and
 * password are closed over and are reachable only through the returned
 * functions. The composed context carries those functions (and the non-secret
 * settings), so the lib transports send requests without ever seeing a
 * credential value — and nothing the returned api exposes reads one back:
 * `context.get()` hands back functions, JSON.stringify drops them,
 * util.inspect shows `[Function]`, and no leaf, error, report or dry-run
 * answer reads a credential (tests/credentials.test.vitest.mjs asserts this).
 *
 * The closures also carry the per-instance legacy session state (cookies, CSRF
 * token, the origin the login succeeded on) — same isolation: two
 * `createUnifi` instances in one process never share sessions, and nothing
 * exports a cookie value.
 *
 * The login is the port of unifi-cli's `lib/api/login/login.mjs` (UniFi OS on
 * `:443`, legacy fallback on `:8443` with the `unifises` cookie and a Referer
 * header); the request path is the port of `lib/api/request/request.mjs`
 * (cookie + CSRF headers, self re-login on a missing session and once on a
 * 401). The offline/skip-login cache read becomes fixture replay in the test
 * harness; `process.exit` paths become typed errors.
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
 * Builds the per-instance legacy auth closure.
 *
 * @param {{
 *   fetch: typeof fetch,
 *   credentials: { username: string|null, password: string|null },
 *   baseUrl: string, site: string,
 *   timeoutMs: number, loginTimeoutMs: number, userAgent: string,
 * }} auth
 * @returns {{
 *   hasSession: (siteKey?: string) => boolean,
 *   login: (siteKey?: string, options?: { host?: string }) => Promise<object>,
 *   request: (params: object) => Promise<any>,
 *   url: (endpoint: string, variables?: object, overrides?: object) => string,
 *   check: (url: string) => Promise<{ ok: boolean, data: any, body: any }|null>,
 *   meta: (siteKey?: string) => object,
 *   setMeta: (siteKey: string, patch: object) => void,
 *   clearAll: () => void,
 * }}
 */
export function createLegacyAuth(auth) {
	// The secret state: the legacy account, and the per-site session (cookies,
	// CSRF token, the origin the login succeeded on) plus the detection metadata
	// the probe writes back.
	const sessions = new Map();

	const session = (siteKey) => sessions.get(siteKey || auth.site) ?? null;

	function setSession(siteKey, patch) {
		const key = siteKey || auth.site;
		sessions.set(key, { ...(sessions.get(key) ?? {}), ...patch });
	}

	/**
	 * Logs the legacy account in and stores the session for the site. The UniFi
	 * OS attempt runs first; on failure the legacy controller attempt runs. Both
	 * attempts failing throws AuthError("AUTH_LOGIN_FAILED").
	 */
	async function login(siteKey, options = {}) {
		const { username, password } = auth.credentials;
		if (!username || password === null || password === undefined) {
			throw new AuthError("AUTH_NO_CREDENTIALS", "legacy login requested but no legacy username/password was given to createUnifi");
		}

		const key = siteKey || auth.site;
		const host = options.host || auth.baseUrl;
		const startedAt = Date.now();
		let osError;

		// --- Step 1: UniFi OS login on :443 ---
		const host443 = /:\d+/.test(host) ? host.replace(/:\d+$/, ":443") : host;
		// The legacy fallback port is explicit: unifi-cli's legacy controllers answer on :8443.
		const host8443 = /:\d+/.test(host) ? host.replace(/:\d+$/, ":8443") : `${host.replace(/\/$/, "")}:8443`;
		const osLoginUrl = `${host443}/api/auth/login`;
		try {
			const res = await auth.fetch(osLoginUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Accept": "application/json",
					"User-Agent": auth.userAgent
				},
				body: JSON.stringify({ username, password }),
				signal: AbortSignal.timeout(auth.loginTimeoutMs)
			});
			const cookies = cookieHeader(setCookies(res));
			const csrfToken = res.headers.get("x-csrf-token");
			if (res.ok && cookies) {
				setSession(key, {
					cookies,
					csrfToken: csrfToken ?? null,
					loggedIn: true,
					// The origin the session's cookies were issued for — every later
					// legacy request goes here, port included.
					hostUrl: host443,
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
		const legacyLoginUrl = `${host8443}/api/login`;
		try {
			const res = await auth.fetch(legacyLoginUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Accept": "application/json",
					"User-Agent": auth.userAgent,
					"Referer": `${host8443}/login`
				},
				body: JSON.stringify({ username, password }),
				signal: AbortSignal.timeout(auth.loginTimeoutMs)
			});
			const cookies = setCookies(res);
			if (res.ok && cookies.some((cookie) => cookie.toLowerCase().startsWith("unifises"))) {
				const header = cookieHeader(cookies);
				setSession(key, {
					cookies: header,
					csrfToken: res.headers.get("x-csrf-token") ?? null,
					loggedIn: true,
					// The fallback origin — the classic controller answered on :8443,
					// and every later legacy request must carry that port.
					hostUrl: host8443,
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
			sessions.delete(key);
			throw new AuthError("AUTH_LOGIN_FAILED", `login failed after ${Date.now() - startedAt}ms total (UniFi OS + legacy attempts)`, {
				attempts: [osError?.message, err?.message].filter(Boolean)
			});
		}
	}

	/** True when the site has a usable legacy session (cookie present). */
	function hasSession(siteKey) {
		const state = session(siteKey);
		return Boolean(state?.loggedIn && state.cookies);
	}

	/** Builds the request headers for a legacy call from the session state. */
	function legacyHeaders(state, hasBody) {
		return {
			"Accept": "application/json",
			...(hasBody ? { "Content-Type": "application/json" } : {}),
			...(state?.cookies ? { "Cookie": state.cookies } : {}),
			...(state?.csrfToken ? { "X-Csrf-Token": state.csrfToken } : {}),
			"User-Agent": auth.userAgent
		};
	}

	/** Resolves the full URL for a legacy endpoint without sending anything. */
	function url(endpoint, variables = {}, overrides = {}) {
		const state = session() ?? {};
		const siteData = {
			host_url: state.hostUrl ?? auth.baseUrl,
			site: siteKeyOf(),
			api: {
				prefix: state.apiPrefix ?? (state.loginType === "legacy" ? LEGACY_PREFIX : UNIFI_OS_PREFIX),
				endpointType: state.endpointType,
				endpointVersion: state.endpointVersion
			}
		};
		return resolveUrl(siteData, endpoint, variables, overrides);
	}

	const siteKeyOf = () => auth.site;

	/** Parses a response body as JSON, tolerating an empty body. */
	async function parseBody(res) {
		const text = await res.text();
		if (text.trim() === "") return null;
		try {
			return JSON.parse(text);
		} catch {
			throw new TransportError("TRANSPORT_BODY_UNPARSEABLE", `response body is not JSON: ${String(text).slice(0, 120)}`);
		}
	}

	async function send(siteKey, params) {
		const { endpoint, method = "GET", data = null, variables = {}, endpointType, endpointVersion, relogin = true } = params;
		const state = session(siteKey) ?? {};
		const siteData = {
			host_url: state.hostUrl ?? auth.baseUrl,
			site: siteKey,
			api: {
				prefix: state.apiPrefix ?? (state.loginType === "legacy" ? LEGACY_PREFIX : UNIFI_OS_PREFIX),
				endpointType: state.endpointType,
				endpointVersion: state.endpointVersion
			}
		};
		const requestUrl = resolveUrl(siteData, endpoint, variables, { endpointType, endpointVersion });
		const startedAt = Date.now();

		let res;
		try {
			res = await auth.fetch(requestUrl, {
				method,
				headers: legacyHeaders(state, data !== null && data !== undefined),
				body: data !== null && data !== undefined ? JSON.stringify(data) : undefined,
				signal: AbortSignal.timeout(auth.timeoutMs)
			});
		} catch (err) {
			const error = new TransportError("TRANSPORT_REQUEST_FAILED", `${method} ${requestUrl} failed: ${err?.message ?? err}`);
			recordError({ kind: "transport", method, url: requestUrl, message: error.message });
			throw error;
		}

		if (res.status === 401 && relogin) {
			// Session expired mid-flight: clear it, log in again, retry once.
			recordError({ kind: "relogin", method, url: requestUrl, status: 401 });
			sessions.delete(siteKey);
			await login(siteKey);
			return send(siteKey, { ...params, relogin: false });
		}

		const body = await parseBody(res);
		if (!res.ok) {
			const message = body?.meta?.msg ?? body?.message ?? `${res.status} ${res.statusText ?? ""}`.trim();
			const error = new ApiError(res.status, body?.meta?.msg ?? null, `${method} ${requestUrl} answered ${res.status}: ${message}`, {
				method,
				url: requestUrl
			});
			recordError({ kind: "http", method, url: requestUrl, status: res.status, message, durationMs: Date.now() - startedAt });
			throw error;
		}
		return body;
	}

	/**
	 * Makes an authenticated legacy API request: logs in first when the session
	 * is missing (unifi-cli's request path), then sends.
	 */
	async function request(params) {
		const { siteKey, ...rest } = params;
		const key = siteKey || auth.site;
		if (!hasSession(key)) {
			await login(key);
		}
		return send(key, rest);
	}

	/**
	 * One raw detection check (unifi-cli's `tryCheck` shape): fetch a URL with
	 * the session's headers, pick a data object. Returns { data, body } on
	 * success, null on failure.
	 */
	async function check(requestUrl) {
		const state = session() ?? {};
		try {
			const res = await auth.fetch(requestUrl, {
				headers: {
					...(state.cookies ? { "Cookie": state.cookies } : {}),
					...(state.csrfToken ? { "X-Csrf-Token": state.csrfToken } : {})
				},
				signal: AbortSignal.timeout(auth.timeoutMs)
			});
			if (!res.ok) return null;
			const body = await res.json();
			return { data: body?.data?.[0] ?? null, body };
		} catch {
			return null;
		}
	}

	/**
	 * The non-secret session/detection metadata, for the probe and reports.
	 * Never carries the cookies or the credentials.
	 */
	function meta(siteKey) {
		const state = session(siteKey) ?? {};
		return {
			loggedIn: Boolean(state.loggedIn && state.cookies),
			loginType: state.loginType ?? null,
			hostUrl: state.hostUrl ?? null,
			prefix: state.apiPrefix ?? (state.loginType === "legacy" ? LEGACY_PREFIX : UNIFI_OS_PREFIX),
			endpointType: state.endpointType ?? null,
			endpointVersion: state.endpointVersion ?? null,
			version: state.version ?? null,
			hostname: state.hostname ?? null,
			name: state.name ?? null,
			deviceType: state.deviceType ?? null
		};
	}

	/** Writes detection metadata into the site's session state. */
	function setMeta(siteKey, patch) {
		setSession(siteKey, patch);
	}

	/** Forgets every site's session (used before a re-probe). */
	function clearAll() {
		sessions.clear();
	}

	return { hasSession, login, request, url, check, meta, setMeta, clearAll };
}

/**
 * Builds the per-instance official Integration API transport closure.
 *
 * @param {{
 *   fetch: typeof fetch,
 *   apiKey: string|null,
 *   baseUrl: string, officialBase: string, timeoutMs: number, userAgent: string,
 * }} transport
 * @returns {{ request: (params: object) => Promise<any> }}
 */
export function createOfficialTransport(transport) {
	/**
	 * Makes one official API request — the API key rides the header from the
	 * closure and is never exposed.
	 * @param {{ method?: string, path: string, query?: Record<string, string|number>, body?: object|null }} params
	 * @returns {Promise<any>} parsed JSON, or null for an empty body
	 * @throws {CapabilityError} when no API key was given ("OFFICIAL_NO_API_KEY")
	 * @throws {ApiError} when the controller answers non-2xx
	 * @throws {TransportError} when the fetch itself fails
	 */
	async function request(params) {
		const { method = "GET", path, query, body = null } = params;
		if (!transport.apiKey) {
			throw new CapabilityError("OFFICIAL_NO_API_KEY", "the official Integration API path needs `credentials.apiKey` in createUnifi", {
				capability: "official",
				hint: "create an API key on the console (Settings › Control Plane › Integrations) or pass credentials.legacy for the legacy path"
			});
		}
		const base = `${transport.baseUrl}${transport.officialBase}`;
		const qs = query
			? Object.entries(query)
					.filter(([, v]) => v !== undefined && v !== null)
					.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
					.join("&")
			: "";
		const url = qs ? `${base}${path}?${qs}` : `${base}${path}`;
		let res;
		try {
			res = await transport.fetch(url, {
				method,
				headers: {
					"X-API-KEY": transport.apiKey,
					"Accept": "application/json",
					...(body !== null && body !== undefined ? { "Content-Type": "application/json" } : {}),
					"User-Agent": transport.userAgent
				},
				body: body !== null && body !== undefined ? JSON.stringify(body) : undefined,
				signal: AbortSignal.timeout(transport.timeoutMs)
			});
		} catch (err) {
			const error = new TransportError("TRANSPORT_REQUEST_FAILED", `${method} ${url} failed: ${err?.message ?? err}`);
			recordError({ kind: "transport", method, url, message: error.message });
			throw error;
		}

		const text = await res.text();
		if (!res.ok) {
			const parsed = parseOfficialError(text);
			const error = new ApiError(res.status, parsed.code, `${method} ${url} answered ${res.status}: ${parsed.message}`, { method, url });
			recordError({ kind: "http", method, url, status: res.status, message: parsed.message });
			throw error;
		}
		if (text.trim() === "") return null;
		try {
			return JSON.parse(text);
		} catch {
			throw new TransportError("TRANSPORT_BODY_UNPARSEABLE", `response body is not JSON: ${text.slice(0, 120)}`);
		}
	}

	return { request };
}

/**
 * Parses an Integration API error body into { code, message }. Understands
 * both the Integration API shape and the UniFi OS proxy shape.
 * @param {string} raw
 * @returns {{ code: string|null, message: string }}
 */
export function parseOfficialError(raw) {
	try {
		const body = JSON.parse(raw);
		if (body && typeof body === "object" && !Array.isArray(body)) {
			if (typeof body.message === "string") {
				return { code: typeof body.code === "string" ? body.code : null, message: body.message };
			}
			if (body.error && typeof body.error === "object" && typeof body.error.message === "string") {
				return {
					code: typeof body.error.code === "number" ? String(body.error.code) : (body.error.code ?? null),
					message: body.error.message
				};
			}
		}
	} catch {
		/* not JSON — fall through to the raw body */
	}
	return { code: null, message: String(raw).slice(0, 200) };
}
