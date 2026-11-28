/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/devices/action.mjs
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
 * @fileoverview `devices.action(id, request, options)` — run a device action
 * (the Integration API's device action endpoint; the documented action today
 * is `RESTART`, the default request). Official-only.
 *
 * @param {string} id the device id
 * @param {object} [request] the action request, `{ action: "RESTART" }` by default
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok: true, capability: "official", response }`, or the
 *   dry-run description — a dry run sends nothing
 * @throws {ValidationError} on a missing id or a bad action request
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function action(id, request = { action: "RESTART" }, options = {}) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "the device id is required");
	}
	if (request === null || typeof request !== "object" || Array.isArray(request) || request.action !== "RESTART") {
		throw new ValidationError(
			"VALIDATION_BODY",
			'the action request must be { action: "RESTART" } — the one action the Integration API documents'
		);
	}
	return officialWrite("devices", { method: "POST", relative: "devices/{id}/actions", vars: { id }, body: request }, options);
}
