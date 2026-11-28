/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/lib/util.mjs
 *	@Date: 2026-11-28T04:39:26-08:00 (1795869566)
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
 * @fileoverview The small shared helpers, ported from unifi-cli's
 * `lib/api/util/util.mjs` as internals under `src/lib/` (PLAN §6.2). The CLI
 * file carries exactly one helper today — `size` — ported as written; the
 * util module is the home for the next such helper rather than a new file per
 * one-liner.
 */

/**
 * The size of a string, an array, a Map/Set, or a plain object (its key
 * count) — unifi-cli's `size` as written.
 * @param {string|any[]|Map<any,any>|Set<any>|object} variable
 * @returns {number}
 */
export function size(variable) {
	return variable.length || Object.keys(variable).length || variable.size;
}
