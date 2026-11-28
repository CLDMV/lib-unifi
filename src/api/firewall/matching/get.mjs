/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/firewall/matching/get.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:04-08:00 (1795870564)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { officialGet } from "../../../lib/crud.mjs";
import { ValidationError } from "../../../lib/errors.mjs";

/**
 * @fileoverview `firewall.matching.get(id)` — one traffic matching list (its type and
 * the entries the firewall policies match on). Official-only.
 *
 * @param {string} id the resource id (the Integration API's `id`)
 * @returns {Promise<object>} the row as the API answers it
 * @throws {ValidationError} on a missing id
 * @throws {CapabilityError} when the official surface is unavailable
 * @throws {ApiError} 404-shaped when no resource carries that id
 */
export default async function get(id) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "the resource id is required");
	}
	return officialGet("firewall.matching", "traffic-matching-lists/{id}", { id: id });
}
