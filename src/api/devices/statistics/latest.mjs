/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/devices/statistics/latest.mjs
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

import { self } from "@cldmv/slothlet/runtime";
import { CapabilityError, ValidationError } from "../../../lib/errors.mjs";
import { officialRequest } from "../../../lib/transport/official.mjs";

/**
 * @fileoverview `devices.statistics.latest(id)` — one device's latest
 * statistics snapshot (cpu, memory, load, uptime, uplink rates, radio
 * retries), the Integration API's `statistics/latest` read. Official-only.
 *
 * @param {string} id the device id
 * @returns {Promise<object>} the statistics snapshot as the API answers it
 * @throws {ValidationError} on a missing id
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function latest(id) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "devices.statistics.latest needs the device id");
	}
	const caps = await self.capabilities();
	if (caps.devices !== "official") {
		throw new CapabilityError(
			"CAPABILITY_UNAVAILABLE",
			"the per-device statistics read is official-Integration-API only and the official path is unavailable",
			{ capability: "devices", hint: "devices.statistics.list() reads the legacy stat rows when legacy credentials are given" }
		);
	}
	return officialRequest({
		method: "GET",
		path: `/sites/${encodeURIComponent(caps.site)}/devices/${encodeURIComponent(id)}/statistics/latest`
	});
}
