/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/sites/list.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:05-08:00 (1795870565)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";
import { CapabilityError } from "../../lib/errors.mjs";
import { officialList } from "../../lib/transport/official.mjs";
import { legacyRequest, envelopeData } from "../../lib/transport/request.mjs";
import { requireLegacy } from "../../lib/crud.mjs";
import { officialSiteFromRow, legacySiteFromRow } from "../../lib/normalize/site.mjs";

/**
 * @fileoverview `sites.list()` — every site the controller serves, normalized onto
 * `site { id, name, internalReference }`.
 *
 * The official Integration API path (`GET /sites`, the site overview rows) is
 * preferred; the legacy `stat/sites` path fills in what it cannot do (a legacy
 * row's `_id` is the site id and `attr_hidden_id` its internal reference).
 *
 * @returns {Promise<object[]>}
 * @throws {CapabilityError} when neither path can serve the read
 */
export default async function list() {
	const caps = await self.capabilities();
	if (caps.official) {
		const rows = await officialList("/sites", { idOf: (site) => site?.id });
		return rows.map((row) => officialSiteFromRow(row)).filter(Boolean);
	}
	if (caps.endpointVersion !== null) {
		await requireLegacy("sites");
		const body = await legacyRequest({ endpoint: "sites_list", method: "GET" });
		return (Array.isArray(body) ? body : envelopeData(body)).map((row) => legacySiteFromRow(row)).filter(Boolean);
	}
	throw new CapabilityError(
		"CAPABILITY_UNAVAILABLE",
		"no sites surface: neither the official Integration API nor the legacy controller API answered the probe",
		{ capability: "sites", hint: "give createUnifi an apiKey or legacy credentials the controller accepts" }
	);
}
