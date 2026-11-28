/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/devices/forget.mjs
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

import { officialWrite } from "../../lib/crud.mjs";
import { ValidationError } from "../../lib/errors.mjs";

/**
 * @fileoverview `devices.forget(id, options)` — unadopt and remove a device. Official-only.
 *
 * @param {string} id the resource id
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok: true, capability: "official", response }`, or the
 *   dry-run description `{ dryRun: true, capability: "official", request: { method, url, body } }`
 *   — a dry run sends nothing
 * @throws {ValidationError} on a missing id or body
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function run(id, options = {}) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "the resource id is required");
	}
	return officialWrite("devices", { method: "DELETE", relative: "devices/{id}", vars: { id: id }, body: null }, options);
}
