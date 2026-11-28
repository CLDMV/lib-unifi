/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/dns/forward/list.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:44:10-08:00 (1795866250)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";
import { FORWARD_DOMAIN_TYPE, LEGACY_FORWARD_TYPE } from "../../../lib/normalize/dns-record.mjs";

/**
 * @fileoverview `dns.forward.list()` — the site's Forward Domain rules, the
 * per-domain forwarding the mode-1 plan applies (a domain and its subdomains
 * forwarded to one target server): `{ domain, target, id, enabled }`.
 *
 * The rules are records on the site's DNS store — `FORWARD_DOMAIN` policies on
 * the official path, `record_type: "forward"` rows on the legacy static-DNS
 * collection — so this leaf filters `dns.records.list()`. When the probe
 * classified `dns.forward: "none"` there is no forward store and the answer is
 * `[]` (an absent store holds no rules).
 *
 * @returns {Promise<object[]>}
 */
export default async function list() {
	const caps = await self.capabilities();
	if (caps.dns.forward === "none") return [];
	const records = await self.dns.records.list();
	return records
		.filter((record) => (caps.dns.forward === "official" ? record.type === FORWARD_DOMAIN_TYPE : record.type === LEGACY_FORWARD_TYPE))
		.map((record) => ({
			domain: record.domain,
			target: caps.dns.forward === "official" ? record.data.ipAddress : record.data.value,
			id: record.id,
			enabled: record.enabled
		}));
}
