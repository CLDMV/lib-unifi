/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/devices/list.mjs
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
import { CapabilityError } from "../../lib/errors.mjs";
import { officialList } from "../../lib/transport/official.mjs";
import { legacyRequest, envelopeData } from "../../lib/transport/request.mjs";

/**
 * @fileoverview `devices.list()` — the Network gear the site manages (APs,
 * switches, gateways; Protect cameras and NVRs are out of scope), as the
 * serving path answers it: the Integration API's adopted-device overview rows
 * (id, macAddress, ipAddress, model, name, firmwareVersion, state, features)
 * on the official path, the legacy `stat/device` inventory rows (the same
 * shape the controller's own UI reads) on the legacy path. Network gear only —
 * the legacy rows are not filtered, but a Protect controller's cameras live in
 * the Protect application's own store, not in `stat/device`.
 *
 * @returns {Promise<object[]>}
 * @throws {CapabilityError} when neither path can serve the read
 */
export default async function list() {
	const caps = await self.capabilities();
	if (caps.devices === "official") {
		return officialList(`/sites/${encodeURIComponent(caps.site)}/devices`, { idOf: (device) => device?.id });
	}
	if (caps.endpointVersion !== null) {
		const body = await legacyRequest({ endpoint: "device_list", method: "GET" });
		return Array.isArray(body) ? body : envelopeData(body);
	}
	throw new CapabilityError(
		"CAPABILITY_UNAVAILABLE",
		"no devices surface: neither the official Integration API nor the legacy controller API answered the probe",
		{ capability: "devices", hint: "give createUnifi an apiKey or legacy credentials the controller accepts" }
	);
}
