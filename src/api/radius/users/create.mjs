/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/radius/users/create.mjs
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
 * @fileoverview `radius.users.create(users, options)` — add RADIUS user accounts. The
 * legacy batch shape unifi-cli's radius-sync sends: an ARRAY of
 * `{ name, x_password, tunnel_type, tunnel_medium_type, vlan? }` rows (`batch_add`
 * on UniFi OS v2, a POST to the collection on the older surfaces). A single
 * object is accepted and wrapped. Legacy-only. Note: the RADIUS user's
 * password is part of the change being made, so a dry-run answer carries it —
 * it is payload data, not a library credential.
 *
 * @param {object|object[]} data the change, in the legacy controller's own field names
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok, capability: "legacy", response }`, or the dry-run
 *   description `{ dryRun: true, capability: "legacy", request: { method, url, body } }`
 * @throws {ValidationError} on a bad argument
 * @throws {CapabilityError} when the legacy path is unavailable
 */
export default async function run(data, options = {}) {
	// The legacy batch shape: an ARRAY of rows; a single object is wrapped.
	const batch = Array.isArray(data) ? data : [data];
	return legacyWrite("radius.users", { endpoint: "radius_add", method: "POST", data: batch }, options);
}
