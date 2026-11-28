/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/networks/create.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:04-08:00 (1795870564)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { officialWrite } from "../../lib/crud.mjs";
import { ValidationError } from "../../lib/errors.mjs";

/**
 * @fileoverview `networks.create(network, options)` — create a network/VLAN. The official
 * Integration API only: the legacy `rest/networkconf` create is not a row
 * unifi-cli carries, so there is no fallback path. The body is the documented
 * create shape (`{ name, management: "GATEWAY"|"SWITCH"|"UNMANAGED", vlanId, enabled,
 * ipv4Configuration?, dhcpGuarding? }`); the row is not normalized — the caller
 * reads the response the API answers.
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
	return officialWrite("networks", { method: "POST", relative: "networks", body: body }, options);
}
