/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/session.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:44:11-08:00 (1795866251)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Per-instance state: the legacy session (cookies, CSRF token,
 * endpoint type), the resolved official site id, the cached capability probe
 * and a bounded transport-error collector.
 *
 * This module is imported by leaves through a relative path, so slothlet loads
 * one copy of it per library instance (helpers are per instance) — two
 * `createUnifi` instances in one process never share sessions, and
 * `api.slothlet.reload()` gives an instance fresh state.
 *
 * Nothing here may read `self`/`context` at module-init time: the module body
 * runs during composition, where no call context is active. Accessors only.
 */

/** @type {Map<string, object>} siteKey -> site session state */
const sites = new Map();

/** @type {object|null} cached capability probe result */
let probeCache = null;

/** @type {object[]} bounded recent transport errors (oldest first) */
const errorLog = [];
const ERROR_LOG_LIMIT = 50;

/**
 * Read one site's session state, or a default-shaped object when unset.
 * @param {string} siteKey
 * @returns {{ cookies: string|null, csrfToken: string|null, loggedIn: boolean,
 *   apiPrefix: string|null, loginType: string|null, endpointType: string|null,
 *   endpointVersion: string|null, siteId: string|null, version: string|null,
 *   deviceType: string|null, name: string|null, hostname: string|null }}
 */
export function getSite(siteKey) {
	return {
		cookies: null,
		csrfToken: null,
		loggedIn: false,
		apiPrefix: null,
		loginType: null,
		endpointType: null,
		endpointVersion: null,
		siteId: null,
		version: null,
		deviceType: null,
		name: null,
		hostname: null,
		...(sites.get(siteKey) ?? {})
	};
}

/**
 * Deep-merge a patch into one site's session state (ported from unifi-cli's
 * `mergeSite` deep merge, keyed on a single site).
 * @param {string} siteKey
 * @param {object} patch
 */
export function setSite(siteKey, patch) {
	const current = getSite(siteKey);
	sites.set(siteKey, mergeDeep(current, patch));
}

/** Forget one site's session (used before a re-login). */
export function clearSite(siteKey) {
	sites.delete(siteKey);
}

/** Forget every site's session. */
export function clearAllSites() {
	sites.clear();
}

/** @returns {object|null} the cached capability probe, or null */
export function getProbeCache() {
	return probeCache;
}

/** Cache the capability probe result. */
export function setProbeCache(probe) {
	probeCache = probe;
}

/** Drop the cached capability probe (forces a re-probe on the next call). */
export function clearProbeCache() {
	probeCache = null;
}

/** Record a transport error in the bounded collector. */
export function recordError(entry) {
	errorLog.push({ ...entry, at: new Date().toISOString() });
	if (errorLog.length > ERROR_LOG_LIMIT) errorLog.shift();
}

/** @returns {object[]} the recent transport errors (a copy, oldest first) */
export function recentErrors() {
	return [...errorLog];
}

function mergeDeep(target, source) {
	const out = { ...target };
	for (const key of Object.keys(source)) {
		const value = source[key];
		if (
			value !== null &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			out[key] !== null &&
			typeof out[key] === "object" &&
			!Array.isArray(out[key])
		) {
			out[key] = mergeDeep(out[key], value);
		} else {
			out[key] = value;
		}
	}
	return out;
}
