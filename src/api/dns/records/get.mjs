/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/dns/records/get.mjs
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
 * @fileoverview `dns.records.get(id)` — one official DNS policy's full row.
 * Official-only (the legacy static-DNS collection has no single-record read
 * row unifi-cli carries).
 *
 * @param {string} id the policy id (`dns.records.list()` rows carry it)
 * @returns {Promise<object>} the policy row as the API answers it
 * @throws {ValidationError} on a missing id
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function get(id) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "dns.records.get needs the policy id");
	}
	const caps = await self.capabilities();
	if (caps.dns.records !== "official") {
		throw new CapabilityError(
			"CAPABILITY_UNAVAILABLE",
			"the single DNS policy read is official-Integration-API only and the official path is unavailable",
			{ capability: "dns.records", hint: "dns.records.list() reads the legacy static-DNS collection when legacy credentials are given" }
		);
	}
	return officialRequest({ method: "GET", path: `/sites/${encodeURIComponent(caps.site)}/dns/policies/${encodeURIComponent(id)}` });
}
