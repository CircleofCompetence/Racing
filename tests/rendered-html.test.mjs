import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("GitHub Pages entry contains the complete mobile game UI", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /MINI Racer/);
  assert.match(html, /viewport-fit=cover/);
  for (const id of ["game", "left", "right", "jump", "soundToggle", "energy", "distance", "speed", "start"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /public\/game\.css/);
  assert.match(html, /public\/game\.js/);
  assert.doesNotMatch(html, /거대한 거실을 질주|좌우 이동|충돌하면|5초 부스터|세로 화면 추천/);
});

test("game rules include five-second boost and ten-hit energy", async () => {
  const js = await readFile(new URL("public/game.js", root), "utf8");
  assert.match(js, /boostTimer=5/);
  assert.match(js, /energy=Math\.max\(0,energy-10\)/);
  assert.match(js, /baseSpeed=Math\.min\(980,560\+elapsed\*5\.4\)/);
  assert.match(js, /TorusGeometry\(1\.28,\.3,14,32\)/);
  assert.doesNotMatch(js, /handle\.rotation\.y=Math\.PI\/2/);
  assert.match(js, /g\.scale\.setScalar\(\.58\)/);
  assert.match(js, /const laneX=\[-5\.6,-2\.8,0,2\.8,5\.6\]/);
  assert.match(js, /PerspectiveCamera/);
  assert.match(js, /WebGLRenderer/);
  assert.match(js, /CylinderGeometry/);
  assert.match(js, /function spawn\(\)/);
  assert.match(js, /AudioContext/);
  assert.match(js, /startRace\(\)/);
  assert.doesNotMatch(js, /labelTexture|fromCharCode/);
  assert.doesNotMatch(js, /rollTarget|type==="ball"\)o\.rotation\.x/);
  assert.match(js, /spin:type==="ball"\?0/);
  assert.match(js, /function jumpCar\(\)/);
  assert.match(js, /function createBoostPickup\(\)/);
  assert.match(js, /Math\.abs\(lane-chosen\[0\]\)>=3/);
  assert.match(js, /const room = new THREE\.Group\(\), scenery=\[\]/);
  assert.match(js, /prop\.position\.z\+=units\*\.62/);
  assert.match(js, /detail\.position\.z\+=units/);
  assert.match(js, /await import\("\.\/vendor\/three\.module\.js"\)/);
  assert.match(js, /cdn\.jsdelivr\.net\/npm\/three@0\.185\.1/);
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
