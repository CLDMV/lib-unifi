/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/transport/request.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T06:10:32-08:00 (1795875032)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { context } from "@cldmv/slothlet/runtime";

/**
 * @fileoverview The authenticated legacy request path, ported from unifi-cli's
 * `lib/api/request/request.mjs`. The request engine itself (login, cookie and
 * CSRF headers, self re-login, response handling) lives in the per-instance
 * auth closure (`src/lib/auth-client.mjs`) — the credentials never leave it.
 * This module is the leaves' window onto that closure: the same call shapes
 * (`legacyRequest`, `legacyUrl`) the port started with, now backed by the
 * closure instead of module state.
 */

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
	return context.unifi.legacy.request(params);
}

/**
 * Resolves the full URL for a legacy endpoint without sending anything — what
 * a dry-run answer reports. Reads the same site session the real request would.
 *
 * @param {string} endpoint endpoint key
 * @param {Record<string, string>} [variables]
 * @param {{ endpointType?: string, endpointVersion?: string }} [overrides]
 * @returns {string}
 */
export function legacyUrl(endpoint, variables = {}, overrides = {}) {
	return context.unifi.legacy.url(endpoint, variables, overrides);
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
