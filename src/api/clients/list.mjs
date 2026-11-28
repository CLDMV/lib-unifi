/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/clients/list.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
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
import { officialList, resolveOfficialSiteId } from "../../lib/transport/official.mjs";
import { legacyRequest, envelopeData } from "../../lib/transport/request.mjs";
import { officialClientFromRow, legacyClientFromStaRow, legacyClientRecordFromUserRow, normalizeMac } from "../../lib/normalize/client.mjs";

/**
 * @fileoverview `clients.list({ active })` — the controller's clients,
 * normalized onto `client { mac, ip, hostname, network, fixed, active }`.
 *
 * `active: true` (the default) reads the connected clients: `stat/sta` on the
 * legacy path, the Integration API's clients page on the official path.
 * `active: false` additionally answers the offline clients from the legacy
 * `rest/user` client records.
 *
 * When both API paths are available the official list is enriched from the
 * legacy records: the official clients page carries no fixed-IP flag and names
 * networks by id, so the merged client takes its `fixed` IP and its network
 * NAME from the `rest/user` record the controller keeps for the same MAC (the
 * network field is a name on the legacy path, a networkId when only the
 * official path serves the client).
 *
 * @param {{ active?: boolean }} [options]
 * @returns {Promise<object[]>}
 * @throws {CapabilityError} when neither path can serve the read, or when
 *   `active: false` is asked of an official-only deployment (the official API
 *   only carries connected clients)
 * @throws {ValidationError} on a bad option
 */
export default async function list(options = {}) {
	const active = options.active !== false;
	if (typeof active !== "boolean") {
		throw new ValidationError("VALIDATION_ACTIVE", "clients.list takes { active: boolean }");
	}

	const caps = await self.capabilities();
	const clients = [];
	if (caps.clients === "official") {
		// The offline clients live only in the legacy records — fail before
		// fetching when the legacy half cannot serve them.
		if (!active && caps.fixedIp !== "legacy") {
			throw new CapabilityError(
				"CAPABILITY_UNAVAILABLE",
				"clients.list({ active: false }) needs the legacy client records; the official Integration API only carries connected clients",
				{
					capability: "clients",
					hint: "pass legacy credentials to createUnifi for the offline client records"
				}
			);
		}
		const siteId = caps.site ?? (await resolveOfficialSiteId());
		const rows = await officialList(`/sites/${encodeURIComponent(siteId)}/clients`, { idOf: (client) => client?.id });
		for (const row of rows) {
			const client = officialClientFromRow(row);
			if (client) clients.push(client);
		}
		if (caps.fixedIp === "legacy") {
			// Both paths: enrich the official clients from the legacy records (the
			// fixed-IP flag and the network NAME), and on `active: false` add the
			// offline clients. A controller without a rest/user collection (older
			// builds) answers 404 — the enrichment is then simply absent.
			let records = [];
			try {
				const recordsBody = await legacyRequest({ endpoint: "client_records", method: "GET" });
				records = Array.isArray(recordsBody) ? recordsBody : envelopeData(recordsBody);
			} catch (err) {
				if (err?.status !== 404) throw err;
			}
			const byMac = new Map();
			for (const row of records) {
				const mac = normalizeMac(row?.mac);
				if (mac && !byMac.has(mac)) byMac.set(mac, row);
			}
			for (const client of clients) {
				const record = client.mac ? byMac.get(client.mac) : null;
				if (!record) continue;
				if (record.use_fixedip === true && record.fixed_ip) client.fixed = record.fixed_ip;
				client.network = record.last_connection_network_name ?? client.network;
			}
			if (!active) {
				const seen = new Set(clients.map((client) => client.mac));
				for (const row of records) {
					const record = legacyClientRecordFromUserRow(row);
					if (record && !seen.has(record.mac)) clients.push(record);
				}
			}
		}
		return clients;
	}
	if (caps.clients === "legacy") {
		const staBody = await legacyRequest({ endpoint: "client_list", method: "GET" });
		for (const row of Array.isArray(staBody) ? staBody : envelopeData(staBody)) {
			const client = legacyClientFromStaRow(row);
			if (client) clients.push(client);
		}
		if (!active) {
			const recordsBody = await legacyRequest({ endpoint: "client_records", method: "GET" });
			const seen = new Set(clients.map((client) => client.mac));
			for (const row of Array.isArray(recordsBody) ? recordsBody : envelopeData(recordsBody)) {
				const record = legacyClientRecordFromUserRow(row);
				if (record && !seen.has(record.mac)) clients.push(record);
			}
		}
		return clients;
	}
	throw new CapabilityError(
		"CAPABILITY_UNAVAILABLE",
		"no clients surface: neither the official Integration API nor the legacy controller API answered the probe",
		{
			capability: "clients",
			hint: "give createUnifi an apiKey or legacy credentials the controller accepts"
		}
	);
}
