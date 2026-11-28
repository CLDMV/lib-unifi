/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/api/dns/forward/set.mjs
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
import { CapabilityError, ValidationError } from "../../../lib/errors.mjs";
import { officialRequest, officialUrl, resolveOfficialSiteId } from "../../../lib/transport/official.mjs";
import { legacyRequest, legacyUrl, envelopeData } from "../../../lib/transport/request.mjs";
import { officialForwardPolicyBody, legacyForwardBody, isDomainName, isIpLiteral } from "../../../lib/normalize/dns-record.mjs";

/**
 * @fileoverview `dns.forward.set({ domain, target }, options)` — the
 * normalised `dns.forward.set` write: one Forward Domain rule, forwarding
 * `domain` (and its subdomains) to the DNS server at `target`.
 *
 * The official path writes a `FORWARD_DOMAIN` policy on the site's
 * `/dns/policies` collection — creating the policy when none exists for the
 * domain, replacing it when one does. The legacy path writes a
 * `record_type: "forward"` row on the static-DNS collection the same way.
 *
 * Every write takes `{ dryRun: true }` and answers the change it would make;
 * dry-run answers never carry credentials.
 *
 * @param {{ domain: string, target: string, enabled?: boolean }} forward
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok, capability, domain, target, id, created }`,
 *   or the dry-run request description
 * @throws {CapabilityError} when the probed `dns.forward` capability is "none"
 * @throws {ValidationError} on a bad domain or target
 */
export default async function set(forward, options = {}) {
	const domain = typeof forward?.domain === "string" ? forward.domain.trim().replace(/\.$/, "").toLowerCase() : null;
	if (!domain || !isDomainName(domain)) {
		throw new ValidationError(
			"VALIDATION_DOMAIN",
			`dns.forward.set needs a base domain (Ubiquiti's guidance: enter the base domain only), got ${JSON.stringify(forward?.domain)}`
		);
	}
	const target = typeof forward?.target === "string" ? forward.target.trim() : null;
	if (!target || !isIpLiteral(target)) {
		throw new ValidationError(
			"VALIDATION_TARGET",
			`dns.forward.set needs the forwarding target as an IP literal, got ${JSON.stringify(forward?.target)}`
		);
	}

	const caps = await self.capabilities();
	if (caps.dns.forward === "none") {
		throw new CapabilityError(
			"CAPABILITY_UNAVAILABLE",
			"the probe found no Forward Domain capability: neither the official dns/policies collection nor a 9.x legacy static-DNS store answered",
			{
				capability: "dns.forward",
				hint: "the Forward Domain record type needs a 9.x (or later) Network application; the console update is a step for the operator"
			}
		);
	}

	if (caps.dns.forward === "official") {
		const siteId = caps.site ?? (await resolveOfficialSiteId());
		const collectionPath = `/sites/${encodeURIComponent(siteId)}/dns/policies`;
		const body = officialForwardPolicyBody({ domain, target, enabled: forward.enabled });
		const existing = (await self.dns.forward.list()).find((rule) => rule.domain === domain && rule.enabled);
		const method = existing ? "PUT" : "POST";
		const path = existing ? `${collectionPath}/${encodeURIComponent(existing.id)}` : collectionPath;
		if (options.dryRun) {
			return { dryRun: true, capability: "official", existing: existing?.id ?? null, request: { method, url: officialUrl(path), body } };
		}
		const response = await officialRequest({ method, path, body });
		return { ok: true, capability: "official", domain, target, id: response?.id ?? existing?.id ?? null, created: !existing, response };
	}

	// Legacy: the static-DNS collection.
	const body = legacyForwardBody({ domain, target, enabled: forward.enabled });
	const rows = await legacyRequest({ endpoint: "static_dns_list", method: "GET" });
	const existing = (Array.isArray(rows) ? rows : envelopeData(rows)).find(
		(row) => typeof row?.key === "string" && row.key.replace(/\.$/, "").toLowerCase() === domain && row.record_type === "forward"
	);
	const method = existing ? "PUT" : "POST";
	const variables = existing ? { id: existing._id } : {};
	if (options.dryRun) {
		const path = existing ? "static_dns_update" : "static_dns_create";
		return {
			dryRun: true,
			capability: "legacy",
			existing: existing?._id ?? null,
			request: { method, url: legacyUrl(path, variables), body }
		};
	}
	const endpoint = existing ? "static_dns_update" : "static_dns_create";
	const response = await legacyRequest({ endpoint, method, data: body, variables });
	// The transport already threw on a non-2xx status, so only an explicit
	// `meta.rc` error in the envelope marks the write failed.
	const ok = response?.meta?.rc ? response.meta.rc === "ok" : true;
	return { ok, capability: "legacy", domain, target, id: response?._id ?? existing?._id ?? null, created: !existing, response };
}
