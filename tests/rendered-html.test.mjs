import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("GitHub Pages entry contains the complete mobile game UI", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /MINI Racer/);
  assert.match(html, /viewport-fit=cover/);
  for (const id of ["game", "left", "right", "boost", "energy", "distance", "speed", "start"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /public\/game\.css/);
  assert.match(html, /public\/game\.js/);
});

test("game rules include five-second boost and ten-hit energy", async () => {
  const js = await readFile(new URL("public/game.js", root), "utf8");
  assert.match(js, /boostTimer=5/);
  assert.match(js, /energy=Math\.max\(0,energy-10\)/);
  assert.match(js, /baseSpeed=Math\.min\(560,245\+elapsed\*3\.1\)/);
  assert.match(js, /PerspectiveCamera/);
  assert.match(js, /WebGLRenderer/);
  assert.match(js, /CylinderGeometry/);
  assert.match(js, /spawnObstacle\(\)/);
  assert.match(js, /AudioContext/);
});

test("hosted app points at the standalone game", async () => {
  const [page, layout, gameHtml] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("public/game.html", root), "utf8"),
  ]);
  assert.match(page, /src="\/game\.html"/);
  assert.match(layout, /lang="ko"/);
  assert.match(gameHtml, /ENGINE START/);
  assert.doesNotMatch(page + layout, /codex-preview|SkeletonPreview|Starter Project/);
});
