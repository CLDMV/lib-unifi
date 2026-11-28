/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/lib/transport/request.mjs
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
import { ApiError, TransportError } from "../errors.mjs";
import { login, hasSession } from "../auth/login.mjs";
import { getSiteData } from "../sites.mjs";
import { recordError, clearSite } from "../session.mjs";
import { resolveUrl } from "../url.mjs";

/**
 * @fileoverview The authenticated legacy request path, ported from unifi-cli's
 * `lib/api/request/request.mjs`: cookie and CSRF headers, an automatic
 * re-login when the session is missing (and once more on a 401), and the
 * response/error handling. The runtime response cache becomes the
 * recorded-fixture harness in tests — there is no cache in the library, and
 * the offline-replay mode of unifi-cli is not ported as a capture store.
 * `process.exit` becomes typed errors; failed requests are collected in the
 * instance's bounded error log instead of an HTTP-error collector on `self`.
 */

/**
 * Parses a response body as JSON, tolerating an empty body.
 * @param {Response} res
 * @returns {Promise<any>} parsed JSON, or null for an empty body
 * @throws {TransportError} when the body is not usable JSON
 */
async function parseBody(res) {
	const text = await res.text();
	if (text.trim() === "") return null;
	try {
		return JSON.parse(text);
	} catch {
		throw new TransportError("TRANSPORT_BODY_UNPARSEABLE", `response body is not JSON: ${String(text).slice(0, 120)}`);
	}
}

/**
 * Builds the request headers for a legacy call.
 * @param {{ api: { cookies: string|null, csrfToken: string|null } }} siteData
 * @param {boolean} hasBody
 * @param {string} userAgent
 * @returns {Record<string, string>}
 */
export function legacyHeaders(siteData, hasBody, userAgent) {
	return {
		"Accept": "application/json",
		...(hasBody ? { "Content-Type": "application/json" } : {}),
		...(siteData.api?.cookies ? { "Cookie": siteData.api.cookies } : {}),
		...(siteData.api?.csrfToken ? { "X-Csrf-Token": siteData.api.csrfToken } : {}),
		"User-Agent": userAgent
	};
}

/**
 * Reads the legacy envelope's data array (`{ meta: { rc }, data }`, or a bare
 * array, or a bare object).
 * @param {any} body
 * @returns {any[]|any} the `data` payload, or the body itself when it has none
 */
export function envelopeData(body) {
	if (body && typeof body === "object" && !Array.isArray(body) && "data" in body) return body.data ?? [];
	return body;
}

/**
 * Resolves the full URL for a legacy endpoint without sending anything — what
 * a dry-run answer reports. Reads the same site data the real request would.
 *
 * @param {string} endpoint endpoint key
 * @param {Record<string, string>} [variables]
 * @param {{ endpointType?: string, endpointVersion?: string }} [overrides]
 * @returns {string}
 */
export function legacyUrl(endpoint, variables = {}, overrides = {}) {
	const siteData = getSiteData();
	return resolveUrl(siteData, endpoint, variables, overrides);
}

/**
 * Makes an authenticated legacy API request.
 *
 * @param {{
 *   endpoint: string, method?: string, data?: object|null, variables?: object,
 *   siteKey?: string, endpointType?: string, endpointVersion?: string,
 *   relogin?: boolean
 * }} params
 * @returns {Promise<any>} the parsed response body (the whole envelope —
 *   callers use `envelopeData` when they want the data array)
 * @throws {AuthError} when no session can be established
 * @throws {ApiError} when the controller answers non-2xx
 * @throws {TransportError} when the fetch itself fails
 */
export async function legacyRequest(params) {
	const { endpoint, method = "GET", data = null, variables = {}, siteKey, endpointType, endpointVersion, relogin = true } = params;
	const siteData = getSiteData(siteKey);
	const key = siteData.site;

	// Not logged in (or the session was cleared) → log in first, exactly like
	// unifi-cli's request path does before every call.
	if (!hasSession(key)) {
		await login(key);
	}

	return send(key, { endpoint, method, data, variables, endpointType, endpointVersion, relogin });
}

async function send(siteKey, params) {
	const { endpoint, method = "GET", data = null, variables = {}, endpointType, endpointVersion, relogin } = params;
	const config = context.unifi;
	const fresh = getSiteData(siteKey);
	const url = resolveUrl(fresh, endpoint, variables, { endpointType, endpointVersion });
	const startedAt = Date.now();

	let res;
	try {
		res = await config.fetch(url, {
			method,
			headers: legacyHeaders(fresh, data !== null && data !== undefined, config.userAgent),
			body: data !== null && data !== undefined ? JSON.stringify(data) : undefined
		});
	} catch (err) {
		const error = new TransportError("TRANSPORT_REQUEST_FAILED", `${method} ${url} failed: ${err?.message ?? err}`);
		recordError({ kind: "transport", method, url, message: error.message });
		throw error;
	}

	if (res.status === 401 && relogin) {
		// Session expired mid-flight: clear it, log in again, retry once.
		recordError({ kind: "relogin", method, url, status: 401 });
		clearSite(siteKey);
		await login(siteKey);
		return send(siteKey, { ...params, relogin: false });
	}

	const body = await parseBody(res);
	if (!res.ok) {
		const message = body?.meta?.msg ?? body?.message ?? `${res.status} ${res.statusText ?? ""}`.trim();
		const error = new ApiError(res.status, body?.meta?.msg ?? null, `${method} ${url} answered ${res.status}: ${message}`, { method, url });
		recordError({ kind: "http", method, url, status: res.status, message, durationMs: Date.now() - startedAt });
		throw error;
	}
	return body;
}
