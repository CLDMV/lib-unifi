/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/clients/guest/authorize.mjs
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
 * @fileoverview `clients.guest.authorize(id, request, options)` — authorize
 * network access for a guest client (the Integration API's
 * `AUTHORIZE_GUEST_ACCESS` client action). `request` carries the optional
 * limits the API documents: `timeLimitMinutes`, `rxRateLimitKbps`,
 * `txRateLimitKbps`, `dataUsageLimitMBytes`. Official-only.
 *
 * @param {string} id the client id
 * @param {object} [request] the optional guest-access limits
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok: true, capability: "official", response }`, or the
 *   dry-run description — a dry run sends nothing
 * @throws {ValidationError} on a missing id or a non-object request
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function authorize(id, request = {}, options = {}) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "the client id is required");
	}
	if (request === null || typeof request !== "object" || Array.isArray(request)) {
		throw new ValidationError("VALIDATION_BODY", "the guest-access limits must be an object");
	}
	const body = { action: "AUTHORIZE_GUEST_ACCESS", ...request };
	return officialWrite("clients", { method: "POST", relative: "clients/{id}/actions", vars: { id }, body }, options);
}
