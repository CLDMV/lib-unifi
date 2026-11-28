/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/lib/config.mjs
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

import { ConfigError } from "./errors.mjs";

/**
 * @fileoverview The factory config model, ported from unifi-cli's
 * `lib/api/config/config.mjs`. Only the site/host/prefix resolution survives —
 * the config-file and CLI-argument loading (`read`, `load`) is CLI-specific and
 * stays with unifi-cli; `createUnifi` takes the same data as an object.
 *
 * Credentials and the injected `fetch` enter through the factory and stay
 * inside the library's own slothlet instance (per-instance credential
 * isolation): the normalized config is handed to the instance via its
 * `context`, so two `createUnifi` instances in one process never share state.
 */

/** Legacy API prefix on a UniFi OS console (the Network app is proxied). */
export const UNIFI_OS_PREFIX = "/proxy/network/";
/** Prefix on a standalone legacy controller (UniFi Network on its own host). */
export const LEGACY_PREFIX = "/";
/** Where the official Integration API is served on a UniFi OS console. */
export const OFFICIAL_BASE_PATH = "/proxy/network/integration/v1";

/**
 * Normalizes and validates the factory config. Throws ConfigError on anything
 * the library cannot build requests from.
 *
 * @param {{
 *   baseUrl: string,
 *   fetch: typeof fetch,
 *   site?: string,
 *   credentials?: { apiKey?: string, legacy?: { username?: string, password?: string } },
 *   tls?: { spkiPins?: string[] },
 *   officialBase?: string,
 *   timeoutMs?: number,
 *   loginTimeoutMs?: number,
 * }} raw
 * @returns {{
 *   baseUrl: string, origin: string, fetch: typeof fetch, site: string,
 *   credentials: { apiKey: string|null, legacy: { username: string|null, password: string|null } },
 *   tls: { spkiPins: string[]|null }, officialBase: string,
 *   timeoutMs: number, loginTimeoutMs: number, userAgent: string,
 * }}
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

	let origin = baseUrl;
	try {
		origin = new URL(baseUrl).origin;
	} catch {
		throw new ConfigError("CONFIG_BASE_URL_INVALID", `baseUrl is not a usable URL: ${JSON.stringify(raw.baseUrl)}`);
	}

	const legacy = raw.credentials?.legacy ?? {};
	const normalized = {
		baseUrl,
		origin,
		fetch: raw.fetch,
		site: typeof raw.site === "string" && raw.site.trim() !== "" ? raw.site.trim() : "default",
		credentials: {
			apiKey: typeof raw.credentials?.apiKey === "string" && raw.credentials.apiKey.trim() !== "" ? raw.credentials.apiKey.trim() : null,
			legacy: {
				username: typeof legacy.username === "string" && legacy.username.trim() !== "" ? legacy.username.trim() : null,
				password: typeof legacy.password === "string" ? legacy.password : null
			}
		},
		// TLS pinning is the injected fetch's business (the caller binds it); the
		// library only carries the pins so leaves can report what was configured.
		tls: { spkiPins: Array.isArray(raw.tls?.spkiPins) ? [...raw.tls.spkiPins] : null },
		officialBase:
			typeof raw.officialBase === "string" && raw.officialBase.trim() !== "" ? raw.officialBase.replace(/\/+$/, "") : OFFICIAL_BASE_PATH,
		timeoutMs: Number.isFinite(raw.timeoutMs) && raw.timeoutMs > 0 ? raw.timeoutMs : 10000,
		loginTimeoutMs: Number.isFinite(raw.loginTimeoutMs) && raw.loginTimeoutMs > 0 ? raw.loginTimeoutMs : 8000,
		userAgent: "@cldmv/lib-unifi"
	};

	// Neither credential is required: a caller may compose the library for
	// dry-run planning before credentials exist. Reads and sends fail with
	// typed errors until either an apiKey or a full legacy username/password
	// pair is given.

	return normalized;
}
