// A thread of gold across the sky: the path of what fell the night Cinderfall burned. A camera-facing ribbon along a
// curve that can be written in (uProg) and fades along its length. Additive light that leaves the scene alpha alone,
// so the ink pass reads it as gold (an accent it keeps) rather than as flame or smoke.
import * as THREE from 'three';

export function createGoldTrail(points, { width = 8, segments = 240, color = [1, 0.7, 0.28], intensity = 4, head = 1.6 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const pts = curve.getSpacedPoints(segments);
  const n = pts.length;
  const pos = new Float32Array(n * 6), tan = new Float32Array(n * 6), side = new Float32Array(n * 2), at = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], d = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      pos.set([p.x, p.y, p.z], j * 3);
      tan.set([d.x, d.y, d.z], j * 3);
      side[j] = k ? 1 : -1;
      at[j] = i / (n - 1);
    }
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aTan', new THREE.BufferAttribute(tan, 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aT', new THREE.BufferAttribute(at, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const uniforms = {
    uProg: { value: 1 }, uTail: { value: 0 }, uAlpha: { value: 1 }, uWidth: { value: width }, uHead: { value: head },
    uCol: { value: new THREE.Color(...color).multiplyScalar(intensity) }, uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: `attribute vec3 aTan; attribute float aSide, aT; uniform float uWidth, uProg, uHead; varying float vT, vS;
      void main(){
        vT = aT; vS = aSide;
        vec4 wp = modelMatrix * vec4(position, 1.);
        vec3 tw = normalize(mat3(modelMatrix) * aTan);
        vec3 toCam = normalize(cameraPosition - wp.xyz);
        vec3 sd = cross(tw, toCam); float sl = length(sd); sd = sl > 1e-4 ? sd / sl : vec3(0., 1., 0.);
        // thin where it begins, swelling toward the burning head
        float w = uWidth * mix(.25, 1., smoothstep(0., .6, aT)) * (1. + uHead * exp(-abs(uProg - aT) * 60.));
        // keep a few pixels of width at any distance
        float dist = length(cameraPosition - wp.xyz);
        w = max(w, dist * .0035);
        wp.xyz += sd * aSide * w * .5;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform float uProg, uTail, uAlpha, uTime; uniform vec3 uCol; varying float vT, vS;
      void main(){
        if (vT > uProg || vT < uTail) discard;
        float core = exp(-vS * vS * 5.) ;
        float glow = exp(-vS * vS * 1.4) * .45;
        // older parts of the stroke dim; the writing head burns white-gold
        float age = clamp((uProg - vT) / max(uProg - uTail, 1e-3), 0., 1.);
        float headK = exp(-(uProg - vT) * 45.);
        float shimmer = .85 + .15 * sin(vT * 180. - uTime * 6.);
        float a = (core + glow) * mix(1., .35, age) * shimmer * uAlpha * smoothstep(uTail, uTail + .04, vT);
        vec3 c = mix(uCol, vec3(1., .95, .82) * length(uCol) * .8, headK * core);
        gl_FragColor = vec4(c * (1. + headK * 2.), clamp(a, 0., 1.));
      }`,
  });
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { mesh, uniforms, curve, at: t => curve.getPointAt(Math.min(1, Math.max(0, t))) };
}
