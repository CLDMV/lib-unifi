/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/devices/get.mjs
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
import { officialRequest } from "../../lib/transport/official.mjs";
import { legacyRequest, envelopeData } from "../../lib/transport/request.mjs";

/**
 * @fileoverview `devices.get(id)` — one device's full row: the Integration
 * API's adopted-device detail (interfaces, ports with PoE state, radios,
 * uplink) on the official path, the legacy `stat/device/{id}` row on the
 * legacy path. The id is the controller's own id (the Integration API's `id`,
 * the legacy row's `_id`).
 *
 * @param {string} id the device id
 * @returns {Promise<object>} the device row as the serving path answers it
 * @throws {ValidationError} on a missing id
 * @throws {CapabilityError} when neither path can serve the read
 */
export default async function get(id) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "devices.get needs the device id");
	}
	const caps = await self.capabilities();
	if (caps.devices === "official") {
		return officialRequest({ method: "GET", path: `/sites/${encodeURIComponent(caps.site)}/devices/${encodeURIComponent(id)}` });
	}
	if (caps.endpointVersion !== null) {
		// The legacy detail answers the { meta, data } envelope — the leaf
		// returns the row.
		const body = await legacyRequest({ endpoint: "device_detail", method: "GET", variables: { id } });
		const rows = Array.isArray(body) ? body : envelopeData(body);
		return Array.isArray(rows) ? (rows[0] ?? null) : rows;
	}
	throw new CapabilityError(
		"CAPABILITY_UNAVAILABLE",
		"no device detail surface: neither the official Integration API nor the legacy controller API answered the probe",
		{ capability: "devices", hint: "give createUnifi an apiKey or legacy credentials the controller accepts" }
	);
}
