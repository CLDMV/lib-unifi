/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/config.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:06-08:00 (1795870566)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { ConfigError } from "./errors.mjs";

/**
 * @fileoverview The factory config model, ported from unifi-cli's
 * `lib/api/config/config.mjs`. Only the site/host/prefix resolution survives —
 * the config-file and CLI-argument loading (`read`, `load`) is CLI-specific and
 * stays with unifi-cli; `createUnifi` takes the same data as an object.
 *
 * Credentials are normalized here but never stored on the settings object:
 * `createUnifi` hands them to the per-instance auth closures
 * (src/lib/auth-client.mjs) and only those closures read them back. The
 * settings object is what the instance's `context` carries —
 * JSON-serializable, inspect-safe, no secret in it (see
 * tests/credentials.test.vitest.mjs).
 */

/** Legacy API prefix on a UniFi OS console (the Network app is proxied). */
export const UNIFI_OS_PREFIX = "/proxy/network/";
/** Prefix on a standalone legacy controller (UniFi Network on its own host). */
export const LEGACY_PREFIX = "/";
/** Where the official Integration API is served on a UniFi OS console. */
export const OFFICIAL_BASE_PATH = "/proxy/network/integration/v1";

/**
 * Normalizes and validates the factory's non-secret settings. Throws
 * ConfigError on anything the library cannot build requests from.
 *
 * @param {{
 *   baseUrl: string,
 *   fetch: typeof fetch,
 *   site?: string,
 *   officialBase?: string,
 *   timeoutMs?: number,
 *   loginTimeoutMs?: number,
 * }} raw
 * @returns {{
 *   baseUrl: string, origin: string, fetch: typeof fetch, site: string,
 *   tls: { spkiPins: number|null }, officialBase: string,
 *   timeoutMs: number, loginTimeoutMs: number, userAgent: string,
 * }} the settings — no credential value on it; `tls.spkiPins` carries only the
 *   COUNT of configured pins (pinning is the injected fetch's business, and
 *   the values are never reported anywhere)
 */
export function normalizeConfig(raw = {}) {
	if (typeof raw?.baseUrl !== "string" || raw.baseUrl.trim() === "") {
		throw new ConfigError("CONFIG_BASE_URL_REQUIRED", 'createUnifi requires a `baseUrl`, e.g. "https://10.0.0.1"');
	}
	if (typeof raw.fetch !== "function") {
		throw new ConfigError("CONFIG_FETCH_REQUIRED", "createUnifi requires an injected `fetch` — the library never opens sockets itself");
	}

	let baseUrl = raw.baseUrl.trim();
	if (!/^https?:\/\//i.test(baseUrl)) {
		baseUrl = `https://${baseUrl.replace(/^\/+/, "")}`;
	}
	baseUrl = baseUrl.replace(/\/+$/, "");

	let origin;
	try {
		origin = new URL(baseUrl).origin;
	} catch {
		throw new ConfigError("CONFIG_BASE_URL_INVALID", `baseUrl is not a usable URL: ${JSON.stringify(raw.baseUrl)}`);
	}

	return {
		baseUrl,
		origin,
		fetch: raw.fetch,
		site: typeof raw.site === "string" && raw.site.trim() !== "" ? raw.site.trim() : "default",
		// TLS pinning is the injected fetch's business (the caller binds it); the
		// library only counts the configured pins so capabilities() can report
		// that pinning was asked for. The pin VALUES are not stored anywhere.
		tls: { spkiPins: Array.isArray(raw.tls?.spkiPins) ? raw.tls.spkiPins.length : null },
		officialBase:
			typeof raw.officialBase === "string" && raw.officialBase.trim() !== "" ? raw.officialBase.replace(/\/+$/, "") : OFFICIAL_BASE_PATH,
		timeoutMs: Number.isFinite(raw.timeoutMs) && raw.timeoutMs > 0 ? raw.timeoutMs : 10000,
		loginTimeoutMs: Number.isFinite(raw.loginTimeoutMs) && raw.loginTimeoutMs > 0 ? raw.loginTimeoutMs : 8000,
		userAgent: "@cldmv/lib-unifi"
	};
}

/**
 * Normalizes the factory's credentials to the sealed shape. Neither
 * credential is required: a caller may compose the library for dry-run
 * planning before credentials exist — reads and sends fail with typed errors
 * until either an apiKey or a full legacy username/password pair is given.
 *
 * @param {{ credentials?: { apiKey?: string, legacy?: { username?: string, password?: string } } }} raw
 * @returns {{ apiKey: string|null, legacy: { username: string|null, password: string|null } }}
 */
export function normalizeCredentials(raw = {}) {
	const legacy = raw?.credentials?.legacy ?? {};
	return {
		apiKey: typeof raw?.credentials?.apiKey === "string" && raw.credentials.apiKey.trim() !== "" ? raw.credentials.apiKey.trim() : null,
		legacy: {
			username: typeof legacy.username === "string" && legacy.username.trim() !== "" ? legacy.username.trim() : null,
			password: typeof legacy.password === "string" ? legacy.password : null
		}
	};
}
