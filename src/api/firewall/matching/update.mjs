/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/firewall/matching/update.mjs
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

import { officialWrite } from "../../../lib/crud.mjs";
import { ValidationError } from "../../../lib/errors.mjs";

/**
 * @fileoverview `firewall.matching.update(id, list, options)` — update a traffic
 * matching list. Official-only.
 *
 * @param {object} body the request body, exactly as the Integration API documents it
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok: true, capability: "official", response }`, or the
 *   dry-run description `{ dryRun: true, capability: "official", request: { method, url, body } }`
 *   — a dry run sends nothing
 * @throws {ValidationError} on a missing id or body
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function run(id, body, options = {}) {
	if (body === null || typeof body !== "object" || Array.isArray(body)) {
		throw new ValidationError("VALIDATION_BODY", "the request body must be an object, exactly as the Integration API documents it");
	}
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "the resource id is required");
	}
	return officialWrite(
		"firewall.matching",
		{ method: "PUT", relative: "traffic-matching-lists/{id}", vars: { id: id }, body: body },
		options
	);
}
