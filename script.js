import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls";
import { GLTFLoader }    from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/loaders/GLTFLoader";

console.clear();
console.log("SCRIPT BORDER-ONLY loaded at", Date.now());

let scene = new THREE.Scene();
scene.background = new THREE.Color(0x02000c);

let camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 2, 22);

let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.target.set(0, 2, 0);
controls.minDistance = 8;
controls.maxDistance = 80;

let gu = { time: { value: 0 } };

// ── BACKGROUND ────────────────────────────────────────────────────────────────
{
  let sizes = [], shift = [], pts = [];
  for (let i = 0; i < 150000; i++) {
    pts.push(new THREE.Vector3().randomDirection().multiplyScalar(35 + Math.random() * 165));
    sizes.push(Math.random() * 1.5 + 0.5);
    shift.push(
      Math.random() * Math.PI,
      Math.random() * Math.PI * 2,
      (Math.random() * 0.9 + 0.1) * Math.PI * 0.1,
      Math.random() * 0.9 + 0.1
    );
  }
  let g = new THREE.BufferGeometry().setFromPoints(pts);
  g.setAttribute("sizes", new THREE.Float32BufferAttribute(sizes, 1));
  g.setAttribute("shift", new THREE.Float32BufferAttribute(shift, 4));
  let m = new THREE.PointsMaterial({
    size: 0.2, transparent: true, depthTest: false, blending: THREE.AdditiveBlending,
    onBeforeCompile: shader => {
      shader.uniforms.time = gu.time;
      shader.vertexShader = `
        uniform float time;
        attribute float sizes;
        attribute vec4 shift;
        varying vec3 vColor;
        ${shader.vertexShader}
      `.replace(`gl_PointSize = size;`, `gl_PointSize = size * sizes;`)
       .replace(`#include <color_vertex>`, `#include <color_vertex>
          float d = length(abs(position) / vec3(200.)); d = clamp(d, 0., 1.);
          vColor = mix(vec3(227.,155.,0.), vec3(100.,50.,255.), d) / 255.;
        `)
       .replace(`#include <begin_vertex>`, `#include <begin_vertex>
          float moveT = mod(shift.x + shift.z * time, PI2);
          float moveS = mod(shift.y + shift.z * time, PI2);
          transformed += vec3(cos(moveS)*sin(moveT),cos(moveT),sin(moveS)*sin(moveT))*shift.a;
        `);
      shader.fragmentShader = `
        varying vec3 vColor;
        ${shader.fragmentShader}
      `.replace(`#include <clipping_planes_fragment>`, `#include <clipping_planes_fragment>
          float d = length(gl_PointCoord.xy - 0.5);
        `)
       .replace(`vec4 diffuseColor = vec4( diffuse, opacity );`,
          `vec4 diffuseColor = vec4(vColor, smoothstep(0.5, 0.1, d) * 0.55);`);
    }
  });
  let bg = new THREE.Points(g, m);
  scene.add(bg);
  scene.userData.bg = bg;
}

// ── KRISHNA ───────────────────────────────────────────────────────────────────
new GLTFLoader().load("krishna.glb", gltf => {

  let tris = [];
  gltf.scene.traverse(child => {
    if (!child.isMesh) return;
    let geo = child.geometry;
    if (!geo || !geo.attributes.position) return;
    child.updateWorldMatrix(true, false);
    let pos = geo.attributes.position, idx = geo.index, M = child.matrixWorld;
    let gv = i => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    let push = (a, b, c) => { tris.push({ a, b, c, nor: b.clone().sub(a).cross(c.clone().sub(a)).normalize() }); };
    if (idx) { for (let f = 0; f < idx.count; f += 3) push(gv(idx.getX(f)), gv(idx.getX(f+1)), gv(idx.getX(f+2))); }
    else     { for (let f = 0; f+2 < pos.count; f += 3) push(gv(f), gv(f+1), gv(f+2)); }
  });

  if (!tris.length) { console.error("No geometry!"); return; }
  console.log("tris:", tris.length);

  // Area CDF
  let areas = tris.map(({ a, b, c }) => b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5);
  let total = areas.reduce((s, x) => s + x, 0);
  let cdf = []; let acc = 0;
  for (let ar of areas) { acc += ar / total; cdf.push(acc); }

  let camFwd = new THREE.Vector3(0, 0, -1);
  function randTri() {
    let r = Math.random(), lo = 0, hi = cdf.length - 1;
    while (lo < hi) { let m = (lo+hi)>>1; cdf[m] < r ? lo=m+1 : hi=m; }
    return tris[lo];
  }
  function sampleOn(tri) {
    let r1 = Math.random(), r2 = Math.random(), sq = Math.sqrt(r1);
    return tri.a.clone().multiplyScalar(1-sq).addScaledVector(tri.b,sq*(1-r2)).addScaledVector(tri.c,sq*r2);
  }

  // BORDER ONLY — 20k pts, only rim > 0.6, varied sizes
  let borderPts = [], borderRim = [];
  let attempts = 0;
  while (borderPts.length < 20000 && attempts < 600000) {
    attempts++;
    let best = 0, bestTri = tris[0];
    for (let t = 0; t < 8; t++) {
      let tri = randTri();
      let rim = 1.0 - Math.abs(tri.nor.dot(camFwd));
      if (rim > best) { best = rim; bestTri = tri; }
    }
    if (best > 0.6) { borderPts.push(sampleOn(bestTri)); borderRim.push(best); }
  }
  console.log("border pts:", borderPts.length);

  // Centre + scale
  let tmpGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
  tmpGeo.computeBoundingBox();
  let bb = tmpGeo.boundingBox;
  let ctr = new THREE.Vector3(); bb.getCenter(ctr);
  let bbSz = new THREE.Vector3(); bb.getSize(bbSz);
  let sc = 16.0 / bbSz.y;
  let yMin = (bb.min.y - ctr.y) * sc;
  let yRng = bbSz.y * sc;
  console.log("sc:", sc.toFixed(3), "yMin:", yMin.toFixed(2), "yRng:", yRng.toFixed(2));

  let toScene = v => v.clone().sub(ctr).multiplyScalar(sc);
  let pts   = borderPts.map(toScene);
  let sizes = borderRim.map(rim =>
    rim > 0.85 ? Math.random()*2.5+1.5
  : rim > 0.70 ? Math.random()*1.5+0.8
  :              Math.random()*0.8+0.3
  );
  let rimArr = new Float32Array(borderRim);
  let shift  = new Float32Array(pts.length * 4);
  for (let i = 0; i < pts.length; i++) {
    shift[i*4]   = Math.random() * Math.PI;
    shift[i*4+1] = Math.random() * Math.PI * 2;
    shift[i*4+2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1;
    shift[i*4+3] = Math.random() * 0.9 + 0.1;
  }

  let g = new THREE.BufferGeometry().setFromPoints(pts);
  g.setAttribute("sizes", new THREE.Float32BufferAttribute(sizes, 1));
  g.setAttribute("rim",   new THREE.Float32BufferAttribute(rimArr, 1));
  g.setAttribute("shift", new THREE.Float32BufferAttribute(shift, 4));

  let _ym = yMin.toFixed(3), _yr = yRng.toFixed(3);

  let m = new THREE.PointsMaterial({
    size: 0.1, transparent: true, depthTest: false, blending: THREE.AdditiveBlending,
    onBeforeCompile: shader => {
      shader.uniforms.time = gu.time;
      shader.vertexShader = `
        uniform float time;
        attribute float sizes;
        attribute float rim;
        attribute vec4 shift;
        varying vec3 vColor;
        varying float vRim;
        ${shader.vertexShader}
      `.replace(`gl_PointSize = size;`, `gl_PointSize = size * sizes;`)
       .replace(`#include <color_vertex>`, `#include <color_vertex>
          float ny = clamp((position.y - ${_ym}) / ${_yr}, 0.0, 1.0);
          vec3 col;
          if (ny < 0.78) { col = mix(vec3(0.10,0.04,0.90), vec3(0.10,0.85,1.00), pow(ny/0.78,0.65)); }
          else            { col = mix(vec3(0.10,0.85,1.00), vec3(1.00,0.90,0.10), (ny-0.78)/0.22); }
          vColor = mix(col, vec3(0.6,1.0,1.0), rim*rim*0.55);
          vRim = rim;
        `)
       .replace(`#include <begin_vertex>`, `#include <begin_vertex>
          float moveT = mod(shift.x + shift.z * time, PI2);
          float moveS = mod(shift.y + shift.z * time, PI2);
          float amp = mix(0.08, 0.015, clamp(rim*2.0, 0.0, 1.0));
          transformed += vec3(cos(moveS)*sin(moveT),cos(moveT),sin(moveS)*sin(moveT))*shift.a*amp;
        `);
      shader.fragmentShader = `
        varying vec3 vColor;
        varying float vRim;
        ${shader.fragmentShader}
      `.replace(`#include <clipping_planes_fragment>`, `#include <clipping_planes_fragment>
          float d = length(gl_PointCoord.xy - 0.5);
        `)
       .replace(`vec4 diffuseColor = vec4( diffuse, opacity );`,
          `vec4 diffuseColor = vec4(vColor, smoothstep(0.5,0.0,d) * mix(0.15, 0.92, pow(vRim,1.5)));`);
    }
  });

  let mesh = new THREE.Points(g, m);
  mesh.position.y = 0.5;
  scene.add(mesh);
  console.log("Krishna ready ✓");

}, undefined, e => console.error("GLTFLoader:", e));

// ── LOOP ──────────────────────────────────────────────────────────────────────
let clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  controls.update();
  let t = clock.getElapsedTime() * 0.5;
  gu.time.value = t * Math.PI;
  if (scene.userData.bg) scene.userData.bg.rotation.y = t * 0.05;
  renderer.render(scene, camera);
});