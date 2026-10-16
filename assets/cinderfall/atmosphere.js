// Atmosphere shared by every lit surface: distance fog plus a ground-hugging height fog that glows toward the sun.
// three's fog chunks are replaced once, before any program compiles; the extra uniforms are injected per material.
import * as THREE from 'three';

export const FOGU = {
  cfFogSunDir: { value: new THREE.Vector3(0.5, 0.3, 0.8).normalize() },
  cfFogSunCol: { value: new THREE.Color(1, 0.8, 0.6) },
  // x: height falloff (1/m), y: fog floor height, z: height-fog density at the floor, w: sun glow exponent
  cfFogH: { value: new THREE.Vector4(0.03, 0, 0, 8) },
  // x: sun glow strength, y: fog ceiling (0 = none), z: ground glow strength (fire under the smoke), w: aerial haze (1/m, linear)
  cfFogX: { value: new THREE.Vector4(0, 0, 0, 0) },
  cfFogGlow: { value: new THREE.Vector4(0, 0, 30, 140) },      // xyz: glow centre, w: radius
  cfFogGlowCol: { value: new THREE.Color(1, 0.3, 0.08) },
  // x: time (s), y: how patchy the far height fog is (0 = even), z: patch scale (1/m), w: unused
  cfFogT: { value: new THREE.Vector4(0, 0, 0.004, 0) },
  // the painted (toon) light, 0..1: on in the world in colour, off while the world is drawn in ink (the ink pass
  // reads the light, and must see it as it always was)
  cfToonK: { value: 1 },
  // the dark that runs out over the land from where the star came down: xy its origin (world xz), z the front's radius,
  // w how much
  cfDark: { value: new THREE.Vector4(0, 0, 0, 0) },
  // the ring of light that runs out ahead of it: x radius, y amount, z width
  cfRing: { value: new THREE.Vector4(0, 0, 300, 0) },
};

let installed = false;
export function installFog() {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogWorld;
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogWorld = ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix );
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogWorld;
	uniform vec3 cfFogSunDir;
	uniform vec3 cfFogSunCol;
	uniform vec4 cfFogH;
	uniform vec4 cfFogX;
	uniform vec4 cfFogGlow;
	uniform vec3 cfFogGlowCol;
	uniform vec4 cfFogT;
	uniform vec4 cfDark;
	uniform vec4 cfRing;
	float cfHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
	// (the ring of light's front wanders round its circle: the same wander as the wall of light drawn over it)
	float cfRingRag( vec2 d ) { float t = atan( d.y, d.x ); return 40.0 * ( sin( 3.0 * t + 1.3 ) * 0.5 + sin( 7.0 * t + 0.2 ) * 0.3 + sin( 13.0 * t + 2.1 ) * 0.2 ); }
	float cfVN( vec2 p ) {
		vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
		return mix( mix( cfHash( i ), cfHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( cfHash( i + vec2( 0.0, 1.0 ) ), cfHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
	}
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
	vec3 cfRd = vFogWorld - cameraPosition;
	float cfDist = length( cfRd );
	cfRd /= max( cfDist, 1e-4 );
	#ifdef FOG_EXP2
		float cfOD = fogDensity * fogDensity * vFogDepth * vFogDepth;
	#else
		float cfOD = - log( max( 1.0 - smoothstep( fogNear, fogFar, vFogDepth ), 1e-4 ) );
	#endif
		// aerial perspective: a thin linear haze that layers distant ranges into the horizon colour
		cfOD += cfFogX.w * cfDist;
	if ( cfFogH.z > 0.0 ) {
		float cfB = cfFogH.x;
		float cfK = max( cfB * cfRd.y * cfDist, -40.0 );
		float cfI = abs( cfK ) > 1e-4 ? ( 1.0 - exp( - cfK ) ) / cfK : 1.0;
		float cfHF = cfFogH.z * exp( - cfB * ( cameraPosition.y - cfFogH.y ) ) * cfDist * cfI;
		// far off the low fog lies in banks that drift (near the camera the air pass draws the mist)
		if ( cfFogT.y > 0.0 ) {
			vec2 cfP = vFogWorld.xz * cfFogT.z;
			float cfN = cfVN( cfP + vec2( cfFogT.x * 0.004, cfFogT.x * 0.0015 ) ) * 0.65 + cfVN( cfP * 2.7 - vec2( cfFogT.x * 0.006, 0.0 ) + 7.3 ) * 0.35;
			cfHF *= mix( 1.0, 0.25 + 1.5 * cfN * cfN * 1.6, cfFogT.y * smoothstep( 50.0, 220.0, cfDist ) );
		}
		cfOD += cfHF;
	}
	float fogFactor = 1.0 - exp( - cfOD );
	if ( cfFogX.y > 0.0 ) fogFactor = min( fogFactor, cfFogX.y );
	vec3 cfCol = fogColor;
	if ( cfFogH.w > 0.0 ) cfCol += cfFogSunCol * cfFogX.x * pow( max( dot( cfRd, cfFogSunDir ), 0.0 ), cfFogH.w );
	if ( cfFogX.z > 0.0 ) {
		float cfG = length( vFogWorld.xz - cfFogGlow.xz ) / cfFogGlow.w;
		cfCol += cfFogGlowCol * cfFogX.z * exp( - cfG * cfG * 1.6 ) * exp( - max( vFogWorld.y - cfFogGlow.y, 0.0 ) * 0.025 );
	}
	gl_FragColor.rgb = mix( gl_FragColor.rgb, cfCol, fogFactor );
	if ( cfDark.w > 0.0 || cfRing.y > 0.0 ) {
		// (ragged, as smoke and light run over broken country: never a drawn circle)
		float cfDD = length( vFogWorld.xz - cfDark.xy );
		float cfRag = ( cfVN( vFogWorld.xz * 0.0042 + 3.1 ) - 0.5 ) * 240.0 + ( cfVN( vFogWorld.xz * 0.017 ) - 0.5 ) * 70.0;
		gl_FragColor.rgb *= 1.0 - cfDark.w * 0.45 * smoothstep( cfDark.z + 200.0, cfDark.z - 200.0, cfDD + cfRag );
		// (the ring of light: a thin bright front, a glow fading behind it)
		float cfRX = cfDD + cfRingRag( vFogWorld.xz - cfDark.xy ) * min( 1.0, cfRing.x / 300.0 ) - cfRing.x;
		float cfFront = exp( - cfRX * cfRX / ( 9.0 * 9.0 ) ) + exp( - cfRX * cfRX / ( 38.0 * 38.0 ) ) * 0.22, cfTrail = cfRX < 0.0 ? exp( cfRX / 70.0 ) * 0.14 : 0.0;
		gl_FragColor.rgb += ( vec3( 1.0, 0.82, 0.6 ) * cfFront * ( 0.7 + 0.5 * cfVN( vFogWorld.xz * 0.03 ) ) + vec3( 1.0, 0.55, 0.25 ) * cfTrail ) * cfRing.y * 0.32;
	}
#endif
#if defined( OPAQUE ) && ( defined( DOUBLE_SIDED ) || defined( USE_ALPHATEST ) )
	// leaves, grass, cloth: marked in the scene alpha (0.97) so the ink pass paints them as masses, never outlines
	gl_FragColor.a = 0.97;
#endif`;
}

// Give every fogged material the shared atmosphere uniforms.
const done = new WeakSet();
export function addFog(m) {
  if (!m || done.has(m)) return;
  done.add(m);
  if (m.isShaderMaterial || m.isRawShaderMaterial) {
    if (m.fog) Object.assign(m.uniforms, FOGU);
    return;
  }
  if (m.fog === false) return;
  const key = m.customProgramCacheKey();
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = function (shader, renderer) {
    prev.call(this, shader, renderer);
    Object.assign(shader.uniforms, FOGU);
  };
  m.customProgramCacheKey = () => key + '|cffog';
}

export function injectFog(root) {
  root.traverse(o => {
    const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of list) addFog(m);
  });
}
