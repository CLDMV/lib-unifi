/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/index.mjs
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

import slothlet from "@cldmv/slothlet";
import { fileURLToPath } from "node:url";
import { normalizeConfig } from "./lib/config.mjs";

/**
 * @fileoverview The library entry: `createUnifi` composes the library's own
 * slothlet instance over the package's `api/` and returns that api — the
 * returned object IS the library's slothlet api (`self.*` inside the leaves,
 * `api.slothlet.*` for management). Credentials, the injected `fetch` and the
 * site go in through the factory and stay inside the library's own instance
 * (per-instance credential isolation): each call composes a fresh instance
 * with its own session state, so two `createUnifi` instances in one process
 * never share cookies or probes.
 *
 * There is no host-mount surface: no `api.add` manifest, no exported api dir.
 * Callers that embed the library (the Digby drivers) call the factory from
 * their own leaves.
 *
 * Composition is asynchronous (slothlet's module load is), so the factory is
 * async: `const unifi = await createUnifi({ ... })`.
 */

/**
 * Composes a UniFi client api.
 *
 * @param {{
 *   baseUrl: string,
 *   fetch: typeof fetch,
 *   site?: string,
 *   credentials?: {
 *     apiKey?: string,
 *     legacy?: { username?: string, password?: string },
 *   } | (() => above | Promise<above>) | Promise<above>,
 *   // The function/promise forms are resolved once at compose time and the
 *   // instance holds plain values. Nothing is read from the environment.
 *   tls?: { spkiPins?: string[] },
 *   officialBase?: string,
 *   timeoutMs?: number,
 *   loginTimeoutMs?: number,
 * }} config
 *   `baseUrl` — the controller, e.g. "https://10.0.0.1" (https is assumed
 *   without a scheme). `fetch` — the fetch the library uses for every request;
 *   the library never opens sockets itself, so a caller that needs TLS pinning
 *   or a LAN-bound route hands in a fetch that does it (`tls.spkiPins` is
 *   carried for reporting). `credentials.apiKey` — the official UniFi
 *   Integration API key; `credentials.legacy` — the local account for the
 *   legacy controller API fallback. Neither is required at compose time (a
 *   dry-run-only caller may compose first); reads and sends fail with typed
 *   errors until one path has credentials.
 * @returns {Promise<object>} the composed slothlet api — the library's leaves:
 *   `capabilities()`, `networks.list()/.update()`, `clients.list()/
 *   clients.fixed.ip.set()`, `dns.records.list()`, `dns.forward.list()/.set()`.
 * @throws {ConfigError} on a missing baseUrl or a non-function fetch
 *
 * @example
 * import { createUnifi } from "@cldmv/lib-unifi";
 * const unifi = await createUnifi({
 *   baseUrl: "https://10.0.0.1",
 *   fetch,
 *   credentials: { apiKey: "...", legacy: { username: "digby", password: "..." } },
 * });
 * await unifi.capabilities();
 * await unifi.networks.list();
 * await unifi.clients.fixed.ip.set("00:00:5e:00:53:01", "192.0.2.10", { dryRun: true });
 */
export async function createUnifi(config = {}) {
	// `credentials` may also arrive as a getter (sync or async) or a promise —
	// resolved once here, at compose time, so the instance holds plain values.
	let { credentials } = config ?? {};
	if (typeof credentials === "function") credentials = await credentials();
	if (credentials && typeof credentials.then === "function") credentials = await credentials;
	const settings = normalizeConfig({ ...config, credentials });
	return slothlet({
		// A path string in node mode (the layout doc's shape: the api/ folder
		// next to this entry, resolved the same from src/ and from dist/).
		base: fileURLToPath(new URL("./api/", import.meta.url)),
		mode: "eager",
		context: { unifi: settings }
	});
}

export default createUnifi;
