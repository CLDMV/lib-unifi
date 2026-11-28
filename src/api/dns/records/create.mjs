/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/dns/records/create.mjs
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
 * @fileoverview `dns.records.create(policy, options)` — create a local DNS record as an
 * official policy: `{ type, enabled, domain, ...typeFields }` where type is
 * one of `A_RECORD`/`AAAA_RECORD`/`CNAME_RECORD`/`MX_RECORD`/`TXT_RECORD`/
 * `SRV_RECORD`/`FORWARD_DOMAIN` and the type fields are the documented ones
 * (`ipv4Address`, `ipv6Address`, `targetDomain`, `mailServerDomain` +
 * `priority`, `text`, the SRV six, `ipAddress` for forward rules).
 * Official-only — the legacy static-DNS collection stays reachable for the
 * forward rules through `dns.forward.set` (the shape the plan's driver
 * consumes).
 *
 * @param {object} body the request body, exactly as the Integration API documents it
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok: true, capability: "official", response }`, or the
 *   dry-run description `{ dryRun: true, capability: "official", request: { method, url, body } }`
 *   — a dry run sends nothing
 * @throws {ValidationError} on a missing id or body
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function run(body, options = {}) {
	if (body === null || typeof body !== "object" || Array.isArray(body)) {
		throw new ValidationError("VALIDATION_BODY", "the request body must be an object, exactly as the Integration API documents it");
	}
	return officialWrite("dns.records", { method: "POST", relative: "dns/policies", body: body }, options);
}
