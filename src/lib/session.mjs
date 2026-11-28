/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/session.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:07-08:00 (1795870567)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Per-instance state: the cached capability probe and a bounded
 * transport-error collector. (The legacy session state — cookies, CSRF token,
 * the origin the login succeeded on — lives in the per-instance auth closure,
 * src/lib/auth-client.mjs, together with the credentials it serves.)
 *
 * This module is imported by leaves through a relative path, so slothlet loads
 * one copy of it per library instance (helpers are per instance) — two
 * `createUnifi` instances in one process never share state, and
 * `api.slothlet.reload()` gives an instance fresh state.
 *
 * Nothing here may read `self`/`context` at module-init time: the module body
 * runs during composition, where no call context is active. Accessors only.
 */

/** @type {object|null} cached capability probe result */
let probeCache = null;

/** @type {object[]} bounded recent transport errors (oldest first) */
const errorLog = [];
const ERROR_LOG_LIMIT = 50;

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
