/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/index.cjs
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

/**
 * CommonJS entry point — the generic shim, a sibling of the ESM entry. Node's
 * `require()` loads the ESM entry synchronously (require(esm)) as long as its
 * module graph has no top-level await — `src/index.mjs` doesn't: the factory
 * is an async function, not a top-level await.
 *
 * When the ESM namespace carries exactly one distinct value (the factory,
 * exported both as default and named — aliases count once), it is returned
 * itself so `require("@cldmv/lib-unifi")(...)` works; otherwise the namespace
 * object is returned so `require(...).createUnifi` and destructuring match
 * `import`.
 *
 * The build copies this file verbatim to dist/index.cjs, so
 * `require("./index.mjs")` resolves to src/index.mjs in a checkout and to the
 * built copy in dist/.
 *
 * @module @cldmv/lib-unifi
 */
"use strict";

if (!process.features?.require_module) {
	const error = new Error(
		`@cldmv/lib-unifi: require() needs Node.js >=24.15.0 (this is ${process.version}). On older Node.js, load the package with import() instead.`
	);
	error.code = "ERR_REQUIRE_ESM";
	throw error;
}

const esm = require("./index.mjs");
const values = new Set(
	Object.keys(esm)
		.filter((key) => key !== "__esModule")
		.map((key) => esm[key])
);
module.exports = values.size === 1 ? values.values().next().value : esm;
