/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/api/networks/list.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1764329220)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:07:00-07:00 (1764329220)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";
import { CapabilityError } from "../../lib/errors.mjs";
import { officialList, officialRequest, resolveOfficialSiteId } from "../../lib/transport/official.mjs";
import { legacyRequest, envelopeData } from "../../lib/transport/request.mjs";
import { officialNetworkFromDetail, legacyNetworkFromRow } from "../../lib/normalize/network.mjs";

/**
 * @fileoverview `networks.list()` — every network/VLAN the controller serves,
 * normalized onto
 * `network { id, name, vlan, cidr, gateway, dhcp { range, leaseSec }, dns { servers[], domain }, kind }`.
 *
 * The official Integration API path is preferred; the legacy
 * `rest/networkconf` path fills in what it cannot do. The official path reads
 * the networks overview page and then each network's details (the DHCP DNS
 * override lives only in the details), so a homelab's handful of networks cost
 * one request each beyond the list.
 *
 * @returns {Promise<object[]>}
 * @throws {CapabilityError} when neither path can serve the read
 */
export default async function list() {
	const caps = await self.capabilities();
	if (caps.networks === "official") {
		const siteId = caps.site ?? (await resolveOfficialSiteId());
		const overview = await officialList(`/sites/${encodeURIComponent(siteId)}/networks`, { idOf: (network) => network?.id });
		const networks = [];
		for (const entry of overview) {
			const detail = await officialRequest({
				method: "GET",
				path: `/sites/${encodeURIComponent(siteId)}/networks/${encodeURIComponent(entry.id)}`
			});
			const normalized = officialNetworkFromDetail(detail);
			if (normalized) networks.push(normalized);
		}
		return networks;
	}
	if (caps.networks === "legacy") {
		const body = await legacyRequest({ endpoint: "network_config", method: "GET" });
		return (Array.isArray(body) ? body : envelopeData(body)).map((row) => legacyNetworkFromRow(row)).filter(Boolean);
	}
	throw new CapabilityError(
		"CAPABILITY_UNAVAILABLE",
		"no networks surface: neither the official Integration API nor the legacy controller API answered the probe",
		{
			capability: "networks",
			hint: "give createUnifi an apiKey or legacy credentials the controller accepts"
		}
	);
}
