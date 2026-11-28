/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/firewall/acl/ordering/get.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:03-08:00 (1795870563)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { officialGet } from "../../../../lib/crud.mjs";

/**
 * @fileoverview `firewall.acl.ordering.get()` — the user-defined ACL rules'
 * evaluation order (`{ orderedAclRuleIds }`). Official-only.
 *
 * @returns {Promise<object>} the ordering as the API answers it
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function get() {
	return officialGet("firewall.acl", "acl-rules/ordering", {});
}
