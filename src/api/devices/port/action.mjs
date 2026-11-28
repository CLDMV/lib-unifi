/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/devices/port/action.mjs
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

import { officialWrite } from "../../../lib/crud.mjs";
import { ValidationError } from "../../../lib/errors.mjs";

/**
 * @fileoverview `devices.port.action(id, portIdx, request, options)` — run a
 * port action on a device (the documented action today is `POWER_CYCLE`, the
 * PoE power-cycle, the default request). Official-only.
 *
 * @param {string} id the device id
 * @param {number|string} portIdx the port index (the device detail's `ports[].idx`)
 * @param {object} [request] the port action request, `{ action: "POWER_CYCLE" }` by default
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok: true, capability: "official", response }`, or the
 *   dry-run description — a dry run sends nothing
 * @throws {ValidationError} on a missing id/port index or a bad action request
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function action(id, portIdx, request = { action: "POWER_CYCLE" }, options = {}) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "the device id is required");
	}
	if (portIdx === undefined || portIdx === null || portIdx === "" || Number.isNaN(Number(portIdx))) {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "the port index is required");
	}
	if (request === null || typeof request !== "object" || Array.isArray(request) || request.action !== "POWER_CYCLE") {
		throw new ValidationError(
			"VALIDATION_BODY",
			'the port action request must be { action: "POWER_CYCLE" } — the one action the Integration API documents'
		);
	}
	return officialWrite(
		"devices",
		{ method: "POST", relative: "devices/{id}/interfaces/ports/{portIdx}/actions", vars: { id, portIdx }, body: request },
		options
	);
}
