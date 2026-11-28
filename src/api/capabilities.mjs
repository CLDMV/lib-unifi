/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/capabilities.mjs
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

import { runProbe } from "../lib/probe.mjs";

/**
 * @fileoverview The capability probe as a leaf: which of the two API paths
 * carries each capability, and the controller version. The result is cached
 * per instance — pass `{ refresh: true }` to probe again.
 *
 *   `await unifi.capabilities();`
 *   // {
 *   //   networks: "official" | "legacy" | "none",
 *   //   clients: "official" | "legacy" | "none",
 *   //   fixedIp: "legacy" | "none",
 *   //   dns: { records: "official" | "legacy" | "none", forward: "official" | "legacy" | "none" },
 *   //   version: "10.2.105" | null, applicationVersion: string | null,
 *   //   updateAvailable: boolean | null, site: <official site uuid> | null,
 *   //   endpointVersion: "unifi_os_v2" | "unifi_os_v1" | "legacy" | null
 *   // }
 *
 * @param {{ refresh?: boolean }} [options]
 * @returns {Promise<object>} the capability report (see lib/probe.mjs for the rules)
 */
export async function capabilities(options = {}) {
	return runProbe(options);
}
