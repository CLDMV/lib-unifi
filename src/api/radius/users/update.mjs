/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/radius/users/update.mjs
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
import { ValidationError } from "../../../lib/errors.mjs";

/**
 * @fileoverview `radius.users.update(id, users, options)` — update RADIUS user accounts
 * (the legacy batch shape: an ARRAY of the full rows incl. `_id`, sent to
 * `batch_update` on UniFi OS v2 / PUT to the row on the older surfaces).
 * Legacy-only.
 *
 * @param {string} id the row id (`list()` rows carry it)
 * @param {object|object[]} data the change, in the legacy controller's own field names
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok, capability: "legacy", response }`, or the dry-run
 *   description `{ dryRun: true, capability: "legacy", request: { method, url, body } }`
 * @throws {ValidationError} on a bad argument
 * @throws {CapabilityError} when the legacy path is unavailable
 */
export default async function run(id, data, options = {}) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "the row id is required");
	}
	if (data === null || (typeof data !== "object" && !Array.isArray(data))) {
		throw new ValidationError("VALIDATION_BODY", "the change must be an object or an array of rows, in the controller's own field names");
	}
	return legacyWrite("radius.users", { endpoint: "radius_update", method: "PUT", variables: { id }, data }, options);
}
