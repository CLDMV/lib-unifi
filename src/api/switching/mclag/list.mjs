/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/switching/mclag/list.mjs
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

import { officialRead } from "../../../lib/crud.mjs";

/**
 * @fileoverview `switching.mclag.list()` — the multi-chassis LAG domains (peers, link
 * ports, the LAGs each peer carries). Official-only.
 *
 * @returns {Promise<object[]>} the collection as the official Integration API
 *   answers it (each page merged; the rows are the API's own shape)
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function list() {
	return officialRead("switching.mclag", "switching/mc-lag-domains", { topLevel: false, idOf: (item) => item?.id });
}
