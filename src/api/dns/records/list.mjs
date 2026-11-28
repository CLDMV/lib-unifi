/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/api/dns/records/list.mjs
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
import { CapabilityError } from "../../../../lib/errors.mjs";
import { officialList, resolveOfficialSiteId } from "../../../../lib/transport/official.mjs";
import { legacyRequest, envelopeData } from "../../../../lib/transport/request.mjs";
import { officialPolicyFromRow, legacyStaticDnsFromRow } from "../../../../lib/normalize/dns-record.mjs";

/**
 * @fileoverview `dns.records.list()` — every local DNS record the site
 * carries, normalized onto `record { id, type, enabled, domain, ttl, data, origin }`.
 *
 * The official path is the Integration API's `/dns/policies` collection (all
 * pages); the legacy path is the static-DNS collection (`v2/api/site/{site}/
 * static-dns` on UniFi OS, `api/s/{site}/rest/static-dns` on older
 * controllers). Forward Domain rules appear here as records too —
 * `dns.forward.list()` filters them.
 *
 * @returns {Promise<object[]>}
 * @throws {CapabilityError} when neither path can serve the read
 */
export default async function list() {
	const caps = await self.capabilities();
	if (caps.dns.records === "official") {
		const siteId = caps.site ?? (await resolveOfficialSiteId());
		const policies = await officialList(`/sites/${encodeURIComponent(siteId)}/dns/policies`, { idOf: (policy) => policy?.id });
		return policies.map((policy) => officialPolicyFromRow(policy)).filter(Boolean);
	}
	if (caps.dns.records === "legacy") {
		const body = await legacyRequest({ endpoint: "static_dns_list", method: "GET" });
		const rows = Array.isArray(body) ? body : envelopeData(body);
		return rows.map((row) => legacyStaticDnsFromRow(row)).filter(Boolean);
	}
	throw new CapabilityError(
		"CAPABILITY_UNAVAILABLE",
		"no DNS record surface: neither the official Integration API nor the legacy static-DNS collection answered the probe",
		{
			capability: "dns.records",
			hint: "give createUnifi an apiKey or legacy credentials the controller accepts"
		}
	);
}
