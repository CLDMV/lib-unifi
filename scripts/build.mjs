/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: scripts/build.mjs
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

/**
 * @fileoverview The per-file build: `dist/` mirrors `src/` one file per module,
 * each file compiled and minified in place with `keepNames` — never bundled,
 * never moved between files. Slothlet scans the `api/` folder at runtime and
 * derives endpoint names from the file tree, so the build must keep that tree;
 * `src/index.mjs` resolves it with `new URL("./api/", import.meta.url)`, which
 * works unchanged from `src/` and from `dist/`. `src/index.cjs` is copied
 * verbatim (its `require("./index.mjs")` must resolve to the sibling ESM
 * entry).
 */

import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");

/** Collects every .mjs file under a directory. */
function mjsFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) out.push(...mjsFiles(path));
		else if (entry.endsWith(".mjs")) out.push(path);
	}
	return out;
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const entryPoints = mjsFiles(src);
if (entryPoints.length === 0) throw new Error(`no .mjs sources under ${src}`);

await build({
	entryPoints,
	outdir: dist,
	outbase: src,
	bundle: false,
	format: "esm",
	// Keep the .mjs extension — dist/ must mirror src/ file for file (the
	// layout doc's shape; the CJS shim requires ./index.mjs by name).
	outExtension: { ".js": ".mjs" },
	minify: true,
	keepNames: true,
	platform: "node",
	target: "node24",
	sourcemap: true,
	logLevel: "info"
});

// The CJS shim is copied verbatim — it never passes through esbuild.
copyFileSync(join(src, "index.cjs"), join(dist, "index.cjs"));

// Report what landed, so a missing api/ or lib/ file is visible in CI output.
const built = [];
function walk(dir) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) walk(path);
		else built.push(relative(dist, path).split(sep).join("/"));
	}
}
walk(dist);
built.sort();
console.log(`build: ${built.length} files in dist/`);
for (const file of built) console.log(`  ${file}`);
