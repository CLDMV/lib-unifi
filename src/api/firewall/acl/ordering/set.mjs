/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/firewall/acl/ordering/set.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:03-08:00 (1795870563)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { officialWrite } from "../../../../lib/crud.mjs";
import { ValidationError } from "../../../../lib/errors.mjs";

/**
 * @fileoverview `firewall.acl.ordering.set(ordering, options)` — reorder the user-defined
 * ACL rules (`{ orderedAclRuleIds }`). Official-only.
 *
 * @param {object} ordering the ordering object, exactly as the Integration API documents it
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok: true, capability: "official", response }`, or the
 *   dry-run description `{ dryRun: true, capability: "official", request: { method, url, body } }`
 *   — a dry run sends nothing
 * @throws {ValidationError} on a missing id or body
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function run(ordering, options = {}) {
	if (ordering === null || typeof ordering !== "object" || Array.isArray(ordering)) {
		throw new ValidationError("VALIDATION_BODY", "the ordering object must be exactly as the Integration API documents it");
	}
	return officialWrite("firewall.acl", { method: "PUT", relative: "acl-rules/ordering", body: ordering }, options);
}
