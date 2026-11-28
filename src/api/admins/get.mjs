/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/admins/get.mjs
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

import { self } from "@cldmv/slothlet/runtime";
import { CapabilityError, ValidationError } from "../../lib/errors.mjs";
import { legacyRequest, envelopeData } from "../../lib/transport/request.mjs";

/**
 * @fileoverview `admins.get(id)` — one controller login account's row (the
 * UniFi OS v2 `user/{id}` detail; the standalone legacy surface carries no
 * single-admin read, so this leaf needs a UniFi OS controller). Legacy-only.
 *
 * @param {string} id the admin account's id (`admins.list()` rows carry it)
 * @returns {Promise<object>} the admin row as the controller answers it
 * @throws {ValidationError} on a missing id
 * @throws {CapabilityError} when the legacy path is unavailable or the
 *   controller is not a UniFi OS v2 surface
 */
export default async function get(id) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "admins.get needs the admin account id");
	}
	const caps = await self.capabilities();
	if (caps.endpointVersion === null) {
		throw new CapabilityError(
			"CAPABILITY_UNAVAILABLE",
			"the admin detail is a legacy-controller-API read and the legacy path is unavailable",
			{ capability: "admins", hint: "pass credentials.legacy to createUnifi" }
		);
	}
	if (caps.endpointVersion !== "unifi_os_v2") {
		throw new CapabilityError(
			"CAPABILITY_UNAVAILABLE",
			"the single-admin read is a UniFi OS v2 endpoint; a standalone legacy controller carries the list only",
			{ capability: "admins", hint: "use admins.list() on a legacy surface" }
		);
	}
	const body = await legacyRequest({ endpoint: "admin_detail", method: "GET", variables: { id } });
	const rows = Array.isArray(body) ? body : envelopeData(body);
	return Array.isArray(rows) ? (rows[0] ?? null) : rows;
}
