/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/radius/users/delete.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:05-08:00 (1795870565)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { legacyWrite } from "../../../lib/crud.mjs";

/**
 * @fileoverview `radius.users.delete(id, options)` — delete a RADIUS user account by
 * id (`radius.users.list()` rows carry it). Legacy-only.
 *
 * @param {string} id the row id (`list()` rows carry it)
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok, capability: "legacy", response }`, or the dry-run
 *   description `{ dryRun: true, capability: "legacy", request: { method, url, body } }`
 * @throws {ValidationError} on a bad argument
 * @throws {CapabilityError} when the legacy path is unavailable
 */
export default async function run(id, options = {}) {
	return legacyWrite("radius.users", { endpoint: "radius_delete", method: "DELETE", variables: { id }, data: null }, options);
}
