/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/clients/guest/unauthorize.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:02-08:00 (1795870562)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { officialWrite } from "../../../lib/crud.mjs";
import { ValidationError } from "../../../lib/errors.mjs";

/**
 * @fileoverview `clients.guest.unauthorize(id, options)` — unauthorize a
 * guest client and disconnect it (the `UNAUTHORIZE_GUEST_ACCESS` client
 * action; the request body is only the action discriminator). Official-only.
 *
 * @param {string} id the client id
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok: true, capability: "official", response }`, or the
 *   dry-run description — a dry run sends nothing
 * @throws {ValidationError} on a missing id
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function unauthorize(id, options = {}) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "the client id is required");
	}
	return officialWrite(
		"clients",
		{ method: "POST", relative: "clients/{id}/actions", vars: { id }, body: { action: "UNAUTHORIZE_GUEST_ACCESS" } },
		options
	);
}
