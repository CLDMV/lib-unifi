/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/clients/get.mjs
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
import { legacyRequest } from "../../lib/transport/request.mjs";

/**
 * @fileoverview `clients.get(id)` — one client's full row: the Integration
 * API's client detail (guest access, connectedAt) on the official path, the
 * legacy `stat/user/{id}` row (the client's history and config record) on the
 * legacy path. The id is the controller's own id — the Integration API's
 * `id` on the official path, the `_id` of the `stat/sta`/`rest/user` row on
 * the legacy path (`clients.list()` carries it as `client.id`).
 *
 * @param {string} id the client id
 * @returns {Promise<object>} the client row as the serving path answers it
 * @throws {ValidationError} on a missing id
 * @throws {CapabilityError} when neither path can serve the read
 */
export default async function get(id) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "clients.get needs the client id");
	}
	const caps = await self.capabilities();
	if (caps.clients === "official") {
		return officialRequest({ method: "GET", path: `/sites/${encodeURIComponent(caps.site)}/clients/${encodeURIComponent(id)}` });
	}
	if (caps.endpointVersion !== null) {
		return legacyRequest({ endpoint: "client_detail", method: "GET", variables: { id } });
	}
	throw new CapabilityError(
		"CAPABILITY_UNAVAILABLE",
		"no client detail surface: neither the official Integration API nor the legacy controller API answered the probe",
		{ capability: "clients", hint: "give createUnifi an apiKey or legacy credentials the controller accepts" }
	);
}
