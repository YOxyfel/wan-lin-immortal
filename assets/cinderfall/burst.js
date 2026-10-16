// A burst of light beyond the horizon: a camera-facing disc of glow with slow rays and a band of light spreading flat
// along the land, drawn far off and depth-tested, so the ridge in front of it cuts its own silhouette out of the light.
// Additive light that leaves the scene alpha alone.
import * as THREE from 'three';

export function createBurst({ color = [1.0, 0.72, 0.36], hot = [1.0, 0.95, 0.84] } = {}) {
  const uniforms = {
    uI: { value: 0 }, uR: { value: 100 }, uTime: { value: 0 }, uRays: { value: 1 }, uBand: { value: 1 },
    uCol: { value: new THREE.Color(...color) }, uHot: { value: new THREE.Color(...hot) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: true, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: `uniform float uR; varying vec2 vQ;
void main(){
  vQ = position.xy;
  vec4 mv = viewMatrix * vec4((modelMatrix * vec4(0., 0., 0., 1.)).xyz, 1.);
  mv.xy += position.xy * uR;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform float uI, uTime, uRays, uBand; uniform vec3 uCol, uHot; varying vec2 vQ;
// slow rays: a few interfering fans of streaks, each turning at its own pace
float rays(float a){
  float s = 0.;
  for (int k = 0; k < 4; k++) {
    float f = float(k);
    s += pow(.5 + .5 * sin(a * (9. + f * 6.3) + f * 1.7 + uTime * (.04 + f * .025) * (mod(f, 2.) * 2. - 1.)), 5. + f * 5.) * (1. - f * .17);
  }
  return s;
}
void main(){
  float r = length(vQ);
  if (r > 1.) discard;
  float a = atan(vQ.y, vQ.x);
  float core = exp(-r * r * 140.) * 4. + exp(-r * r * 30.) * 1.2;
  float glow = exp(-r * r * 7.) * .85 + exp(-r * 3.) * .5;
  float rr = rays(a) * exp(-r * 1.8) * (1. - exp(-r * r * 300.)) * .7 * uRays;
  // the light spreading flat along the land at the horizon
  float flat_ = exp(-abs(vQ.y) * 26. / (.4 + abs(vQ.x))) * exp(-abs(vQ.x) * 1.4) * 1.1 * uBand;
  vec3 c = uCol * (glow + rr + flat_) + uHot * core;
  c *= smoothstep(1., .75, r) * uI;
  gl_FragColor = vec4(c, 1.);
}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  mesh.visible = false;
  return {
    mesh, uniforms,
    set({ pos, amt, radius, time, rays = 1, band = 1 }) {
      uniforms.uI.value = amt; uniforms.uTime.value = time; uniforms.uR.value = radius;
      uniforms.uRays.value = rays; uniforms.uBand.value = band;
      if (pos) mesh.position.copy(pos);
      mesh.visible = amt > 0.002;
    },
  };
}
