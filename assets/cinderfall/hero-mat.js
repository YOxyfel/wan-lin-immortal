// Materials for the procedural characters. All are MeshStandardMaterial extended with onBeforeCompile (three's
// lights, shadows and fog chunks stay intact): cloth (fabric detail, wear, tatters, hem flutter, ground clamp,
// soft wrap diffuse), skin (procedural eyes / brows / lips with gaze and eyelids, wrap-lit subsurface look,
// optional age wrinkles) and hair (alpha-tested strand cards, Kajiya-Kay two-lobe highlight, volume normals).
import * as THREE from 'three';
import { TOON } from './materials.js';

const NOISE = `
float cfH3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float cfN3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cfH3(i), cfH3(i + vec3(1,0,0)), f.x), mix(cfH3(i + vec3(0,1,0)), cfH3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(cfH3(i + vec3(0,0,1)), cfH3(i + vec3(1,0,1)), f.x), mix(cfH3(i + vec3(0,1,1)), cfH3(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;

// dissolve fade with a thin dark ink rim (uFade: 1 solid .. 0 gone); vFadeP is a stable object/bind-space position
const FADE_VERT = `vFadeP = position;`;
const FADE_PARS = `
uniform float uFade;
varying vec3 vFadeP;
// a fine ink dissolve: two octaves of small noise (~5 cm and ~2 cm) with a slight vertical bias (the head goes first
// when he fades out, the feet come first when he fades in)
float cfFadeT(){ vec3 q = vFadeP * 21.0; float n = cfN3( q ) * 0.62 + cfN3( q * 2.7 + 7.0 ) * 0.38; return n * 0.8 + 0.2 * clamp( vFadeP.y / 1.85, 0.0, 1.0 ); }
// quantile of cfFadeT (measured) so the visible fraction of the surface is ~uFade
float cfFadeQ( float k ){ float x = clamp( k, 0.0, 1.0 ) - 0.5; return 0.495 + x * ( 0.33 + 0.4 * x * x ) + 0.235 * sign( x ) * pow( min( 1.0, 2.0 * abs( x ) ), 25.0 ); }
`;
const FADE_FRAG = `
if ( uFade < 0.999 ) {
  float cfF = cfFadeT(), cfTh = cfFadeQ( uFade );
  if ( cfF > cfTh ) discard;
  // a thin, soft ink edge (~3 mm) where the surface is eaten away
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.035, 0.03, 0.028 ), 0.8 * smoothstep( cfTh - 0.016, cfTh - 0.002, cfF ) );
}
`;
const FADE_DEPTH = `
if ( uFade < 0.999 ) { if ( cfFadeT() > cfFadeQ( uFade ) ) discard; }
`;
export { FADE_VERT, FADE_PARS, FADE_FRAG, FADE_DEPTH, NOISE };

// optional warm rim (e.g. firelight behind him): uRim = (rgb, amount); a soft Fresnel term added as emission
const RIM = (twoSided) => `
#include <emissivemap_fragment>
if ( uRim.w > 0.0 ) {
  float cfNv = dot( normal, normalize( vViewPosition ) );
  float cfRf = 1.0 - clamp( ${twoSided ? 'abs( cfNv )' : 'cfNv'}, 0.0, 1.0 );
  totalEmissiveRadiance += uRim.rgb * ( uRim.w * cfRf * cfRf * cfRf ) * ( diffuseColor.rgb + 0.12 );
}
`;

// shared direct-light override: wrap diffuse (per channel) + standard GGX specular
const wrapDirect = (name, wrapExpr) => `
void ${name}( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  float nl = dot( geometryNormal, directLight.direction );
  vec3 w = ${wrapExpr};
  vec3 diff = clamp( ( vec3( nl ) + w ) / ( 1.0 + w ), 0.0, 1.0 );
  diff *= mix( vec3( 1.0 ), diff, 0.35 );
  ${TOON ? `// (toon) two flat tones with a soft edge: nearly even light, and a shade warmed by the wrap (red under skin)
  vec3 cfShade = w / ( 1.0 + w ) * 0.9 * smoothstep( -0.6, 0.0, nl );
  diff = mix( diff, mix( cfShade, vec3( 0.82 + 0.18 * saturate( nl ) ), smoothstep( -0.03, 0.06, nl ) ), 0.9 * cfToonK );` : ''}
  reflectedLight.directDiffuse += diff * directLight.color * BRDF_Lambert( material.diffuseColor );
  reflectedLight.directSpecular += saturate( nl ) * directLight.color * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
}
#undef RE_Direct
#define RE_Direct ${name}
`;

// --------------------------------------------------------------------------------------------- cloth
const CLOTH_VERT_PARS = `
attribute vec4 aCloth;
varying vec4 vCloth;
varying vec3 vBind;
varying vec3 vFadeP;
uniform float uTime;
uniform vec3 uWindL;
uniform float uFlutter;
`;
const CLOTH_VERT_POST_SKIN = `
{
  float hm = aCloth.y;
  if ( hm > 0.0 ) {
    float ph = uTime * 5.3 + position.x * 11.0 + position.z * 7.0 + aCloth.w * 21.0;
    float fl = sin( ph ) * 0.55 + sin( ph * 1.73 + 1.3 ) * 0.3 + sin( ph * 3.1 + position.y * 9.0 ) * 0.15;
    float ws = length( uWindL );
    vec3 wd = ws > 1e-4 ? uWindL / ws : vec3( 0.0 );
    float amt = hm * uFlutter * ( 0.004 + 0.022 * min( ws, 3.0 ) / 3.0 );
    transformed += wd * amt * ( 1.2 + 0.8 * fl ) + vec3( 0.0, abs( fl ) * amt * 0.5 * min( ws, 3.0 ) / 3.0, 0.0 );
    transformed.x += hm * 0.0025 * sin( uTime * 1.3 + aCloth.w * 9.0 + position.y * 4.0 );
  }
  transformed.y = max( transformed.y, 0.0035 );
}
`;
const CLOTH_FRAG_PARS = `
varying vec4 vCloth;
varying vec3 vBind;
uniform float uAge;
uniform float uTatter;
${NOISE}
${FADE_PARS}
float cfTatter(){
  float edge = vCloth.z;
  if ( edge > 0.4 ) return 1.0;
  vec3 q = vBind;
  float n1 = cfN3( vec3( q.x * 38.0, q.y * 3.0, q.z * 38.0 ) + vCloth.w * 17.0 );
  float n2 = cfN3( vec3( q.x * 110.0, q.y * 9.0, q.z * 110.0 ) );
  float depth = mix( 0.004, 0.11, uAge * uTatter ) * ( 0.25 + 0.75 * pow( n1, 1.7 ) ) + 0.006 * n2 * ( 0.4 + uAge );
  // little holes at 21
  float hole = uAge * uTatter * step( 0.9, cfN3( q * 41.0 + 3.0 ) ) * step( edge, 0.25 );
  return ( edge < depth || hole > 0.5 ) ? 0.0 : 1.0;
}
`;
const CLOTH_FRAG_MAP = `
{
  vec4 det = texture2D( map, vMapUv );
  int ty = int( vCloth.x + 0.5 );
  float d = ( ty == 0 || ty == 6 ) ? det.r : ( ty == 1 || ty == 2 ) ? det.g : det.b;
  vec3 q = vBind;
  float n1 = cfN3( q * 6.0 + vCloth.w * 11.0 ), n2 = cfN3( q * 19.0 + 4.0 ), n3 = cfN3( q * 2.3 + 7.0 );
  vec3 c = diffuseColor.rgb * ( 0.68 + 0.4 * d );
  // fading and wear: lighter worn patches, darker grime
  float wear = smoothstep( 0.55, 0.85, n1 * 0.65 + n2 * 0.35 );
  float grime = smoothstep( 0.5, 0.95, n3 * 0.6 + n2 * 0.4 ) * ( 0.25 + 0.75 * uAge );
  c *= 1.0 + wear * 0.12 * ( 1.0 - uAge * 0.5 );
  c = mix( c, c * vec3( 0.62, 0.56, 0.5 ), grime * 0.55 );
  if ( ty == 0 ) {
    // patches sewn on the tunic at 21: darker linen squares with stitched borders
    vec3 pq = q * vec3( 7.0, 5.0, 7.0 );
    vec3 cell = floor( pq ), f = fract( pq );
    float pick = step( 0.8, cfH3( cell + 0.5 ) ) * uAge;
    float inside = step( 0.12, f.x ) * step( f.x, 0.88 ) * step( 0.1, f.y ) * step( f.y, 0.9 );
    float border = inside * ( 1.0 - step( 0.17, f.x ) * step( f.x, 0.83 ) * step( 0.15, f.y ) * step( f.y, 0.85 ) );
    c = mix( c, c * vec3( 0.7, 0.72, 0.8 ) * ( 0.9 + 0.2 * cfH3( cell ) ), pick * inside );
    c *= 1.0 - pick * border * 0.25;
  }
  if ( ty == 3 ) {
    // crossed leg wraps: two diagonal families of bands, darker seams where they overlap
    vec2 w = vec2( vMapUv.x * 3.0, vMapUv.y * 0.95 );
    float s1 = fract( w.x + w.y ), s2 = fract( w.x - w.y );
    float e1 = min( s1, 1.0 - s1 ), e2 = min( s2, 1.0 - s2 );
    float top = mod( floor( w.x + w.y ) + floor( w.x - w.y ), 2.0 );
    float e = mix( e1, e2, top );
    c *= 0.5 + 0.5 * smoothstep( 0.0, 0.09, e );
    c *= 0.92 + 0.16 * det.r;
  }
  if ( ty == 4 ) c *= mix( 1.0, 0.85 + 0.3 * det.b, uAge );
  diffuseColor.rgb = c;
  if ( cfTatter() < 0.5 ) discard;
  // while he dissolves, the inside of the garments is not drawn: the holes open onto what is behind him
  if ( uFade < 0.999 && !gl_FrontFacing ) discard;
  ${FADE_FRAG}
}
`;

// Figures mark themselves in the scene's alpha (1.1): the ink pass outlines and models them even where the
// ground around them is the same tone (white clothes on snow, a dark figure against night).
const FIGURE_MARK = 'gl_FragColor.a = 1.1;';

export function clothMaterial(tex, U) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, map: tex.cloth, normalMap: tex.clothN, normalScale: new THREE.Vector2(0.38, 0.38),
    roughness: 0.93, metalness: 0, side: THREE.DoubleSide,
  });
  m.name = 'hero-cloth';
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWindL = U.uWindL; sh.uniforms.uFlutter = U.uFlutter;
    sh.uniforms.uAge = U.uAge; sh.uniforms.uTatter = U.uTatter; sh.uniforms.uFade = U.uFade; sh.uniforms.uRim = U.uRim;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + CLOTH_VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloth = aCloth; vBind = position; vFadeP = position;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n' + CLOTH_VERT_POST_SKIN);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uRim;\n' + CLOTH_FRAG_PARS)
      .replace('#include <emissivemap_fragment>', RIM(false))
      .replace('#include <map_fragment>', CLOTH_FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{ int ty = int( vCloth.x + 0.5 ); roughnessFactor = ty == 5 ? 0.62 : ty == 4 ? mix( 0.9, 0.62, uAge ) : ty == 1 ? 0.88 : 0.94; }`)
      .replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + wrapDirect('RE_Direct_Cloth', 'vec3( 0.32 )'))
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FIGURE_MARK);
  };
  m.customProgramCacheKey = () => 'hero-cloth-v4';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  const dist = new THREE.MeshDistanceMaterial();
  for (const dm of [depth, dist]) {
    dm.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime; sh.uniforms.uWindL = U.uWindL; sh.uniforms.uFlutter = U.uFlutter;
      sh.uniforms.uAge = U.uAge; sh.uniforms.uTatter = U.uTatter; sh.uniforms.uFade = U.uFade;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + CLOTH_VERT_PARS)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloth = aCloth; vBind = position; vFadeP = position;')
        .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n' + CLOTH_VERT_POST_SKIN);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + CLOTH_FRAG_PARS)
        .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif ( cfTatter() < 0.5 ) discard;\n' + FADE_DEPTH);
    };
    dm.customProgramCacheKey = () => 'hero-cloth-depth-v2' + (dm.isMeshDistanceMaterial ? 'd' : '');
  }
  return { mat: m, depth, dist };
}

// --------------------------------------------------------------------------------------------- skin
const SKIN_FRAG_PARS = `
varying vec4 vFace;
uniform vec2 uGaze;
uniform float uLid;
uniform vec3 uIris;
uniform vec3 uBrow;
uniform vec3 uLip;
uniform float uWrinkle;
uniform float uMouth;
uniform float uBrowW;
uniform float uEyeH;
uniform float uSmile;
${NOISE}
${FADE_PARS}
float cfEye = 0.0, cfLipM = 0.0, cfBumpH = 0.0;
float cfLine( float d, float w, float aa ){ return 1.0 - smoothstep( w, w + aa, abs( d ) ); }
`;
const SKIN_FRAG_COLOR = `
#include <color_fragment>
if ( vFace.w > 0.5 ) {
  vec3 p = vFace.xyz;
  float ax = abs( p.x );
  float sx = p.x >= 0.0 ? 1.0 : -1.0;
  float aa = max( fwidth( p.y ), fwidth( p.x ) ) * 1.1 + 1e-6;
  vec3 c = diffuseColor.rgb;
  float front = smoothstep( 0.045, 0.065, p.z );
  // ---------------- eyes
  vec2 e = vec2( ax - 0.031, p.y - 0.0004 );
  float ex = clamp( e.x / 0.0146, -1.2, 1.2 );
  float ex2 = clamp( 1.0 - ex * ex, 0.0, 1.0 );
  float yl = ( -0.0036 * pow( ex2, 0.85 ) + 0.0008 * ex ) * mix( 1.0, uEyeH, 0.6 ) - 0.0004;
  float yu0 = ( 0.0047 * pow( ex2, 0.62 ) + 0.0013 * ex ) * uEyeH + 0.0001;
  float yu = mix( yu0, yl + 0.0002, uLid );
  float inEye = smoothstep( -aa, aa, yu - e.y ) * smoothstep( -aa, aa, e.y - yl ) * step( abs( ex ), 1.0 ) * front;
  vec2 ip = vec2( ax - ( 0.031 + uGaze.x * sx ), p.y - ( 0.0006 + uGaze.y ) );
  float ir = length( ip );
  float R = 0.0057;
  vec3 scl = vec3( 0.78, 0.76, 0.73 ) * ( 1.0 - 0.3 * smoothstep( 0.4, 1.0, abs( ex ) ) );
  float ang = atan( ip.y, ip.x );
  float streak = 0.82 + 0.18 * sin( ang * 21.0 + sin( ang * 5.0 ) * 2.0 );
  vec3 iris = uIris * streak * mix( 1.25, 0.5, smoothstep( 0.45 * R, R, ir ) );
  iris = mix( iris, iris * 0.35, smoothstep( 0.82 * R, R, ir ) );
  vec3 ec = mix( scl, iris, smoothstep( R + aa, R - aa, ir ) );
  ec = mix( ec, vec3( 0.015 ), smoothstep( 0.0023 + aa, 0.0023 - aa, ir ) );
  ec *= mix( 0.42, 1.0, smoothstep( 0.0, 0.0032, yu - e.y ) );
  ec = mix( ec, vec3( 0.72, 0.42, 0.4 ), smoothstep( -0.72, -0.98, ex ) * 0.8 );
  c = mix( c, ec, inEye );
  cfEye = inEye;
  // upper lash line, thicker towards the outer corner with a small flick
  float lt = mix( 0.00045, 0.0013, smoothstep( -0.5, 0.95, ex ) ) * ( 1.0 - 0.2 * uLid );
  float lashU = cfLine( e.y - yu - lt * 0.5, lt * 0.5, aa ) * smoothstep( 1.13, 0.98, abs( ex + ( ex > 0.0 ? -0.05 : 0.0 ) ) ) * front;
  float flick = cfLine( e.y - ( yu0 + ( ex - 1.0 ) * 0.004 ), 0.0004, aa ) * smoothstep( 0.92, 1.0, ex ) * smoothstep( 1.22, 1.08, ex ) * front * ( 1.0 - uLid );
  c = mix( c, vec3( 0.055, 0.045, 0.045 ), clamp( lashU + flick, 0.0, 1.0 ) * 0.93 );
  float lashL = cfLine( e.y - yl + 0.00015, 0.00028, aa ) * smoothstep( 1.0, 0.55, abs( ex ) ) * front * ( 1.0 - uLid );
  c = mix( c, vec3( 0.52, 0.38, 0.35 ), lashL * 0.3 );
  // lid crease and a soft lid shadow
  float yc = yu0 + 0.0034 * pow( ex2, 0.5 ) + 0.0005;
  c *= 1.0 - cfLine( e.y - yc, 0.00035, aa * 1.5 ) * smoothstep( 1.0, 0.45, abs( ex ) ) * 0.25 * front;
  c *= 1.0 - 0.1 * smoothstep( 0.009, 0.001, e.y - yu0 ) * step( 0.0, e.y - yu0 ) * smoothstep( 1.25, 0.8, abs( ex ) ) * front;
  // under-eye shading
  c *= 1.0 - 0.06 * smoothstep( 0.008, 0.002, -( e.y - yl ) ) * step( e.y, yl ) * smoothstep( 1.2, 0.7, abs( ex ) ) * front;
  // ---------------- brows
  float bt = clamp( ( ax - 0.0115 ) / 0.046, 0.0, 1.0 );
  float yb = 0.0158 + 0.0042 * sin( bt * 2.4 ) * uBrowW - 0.0012 * bt;
  float bth = mix( 0.0037, 0.0012, pow( bt, 1.05 ) );
  float bm = smoothstep( bth * 0.5 + aa, bth * 0.5 - aa, abs( p.y - yb ) ) * smoothstep( 0.0105, 0.0135, ax ) * smoothstep( 0.0585, 0.054, ax ) * front;
  float strokes = mix( 0.6 + 0.4 * cfN3( vec3( bt * 70.0, ( p.y - yb ) / max( bth, 1e-4 ) * 2.5 + bt * 6.0, sx ) ), smoothstep( 0.35, 0.75, cfN3( vec3( bt * 160.0, ( p.y - yb ) / max( bth, 1e-4 ) * 4.0 + bt * 14.0, sx ) ) ), uWrinkle * 0.7 );
  c = mix( c, uBrow, bm * strokes * 0.95 );
  // ---------------- lips
  // upper lip with a soft cupid's bow, fuller lower lip; low-contrast colour
  float ytop = -0.0447 - 0.0016 * pow( ax / 0.018, 2.0 ) + 0.0008 * exp( -pow( ( ax - 0.0042 ) / 0.0032, 2.0 ) ) - 0.0006 * exp( -pow( ax / 0.002, 2.0 ) );
  float upl = smoothstep( ytop + 0.0004, ytop - 0.0004, p.y ) * step( -0.0535, p.y ) * smoothstep( 0.0185, 0.0155, ax );
  float lo = length( vec2( ax / 0.0158, ( p.y + 0.0586 ) / 0.0062 ) );
  float lm = max( upl, smoothstep( 1.0, 0.7, lo ) ) * smoothstep( 0.068, 0.078, p.z );
  c = mix( c, uLip, lm * 0.5 );
  cfLipM = lm;
  float ym = -0.0533 - 0.0012 * pow( ax / 0.019, 2.0 ) * ( 1.0 - uSmile ) + 0.0016 * pow( ax / 0.019, 3.0 ) * uSmile;
  float mw = 0.00045 + uMouth * 0.0017;
  float ml = cfLine( p.y - ym, mw, aa ) * smoothstep( 0.0205, 0.016, ax ) * smoothstep( 0.074, 0.084, p.z );
  c = mix( c, vec3( 0.22, 0.11, 0.1 ) * ( 1.0 - uMouth * 0.8 ), ml * ( 0.72 + uMouth * 0.28 ) );
  // nostrils
  float ns = smoothstep( 0.0034, 0.0014, length( vec2( ax - 0.006, p.y + 0.0362 ) ) ) * smoothstep( 0.092, 0.098, p.z );
  c = mix( c, vec3( 0.18, 0.09, 0.08 ), ns * 0.85 );
  // cheeks
  c = mix( c, c * vec3( 1.03, 0.86, 0.84 ), 0.25 * exp( -( pow( ( ax - 0.042 ) / 0.016, 2.0 ) + pow( ( p.y + 0.024 ) / 0.014, 2.0 ) ) ) * front );
  // ---------------- age: wrinkles, spots, stubble shadow
  if ( uWrinkle > 0.0 ) {
    float fq = ( p.y - 0.036 ) / 0.0095 + 0.25 * sin( p.x * 70.0 ) + 0.1 * sin( p.x * 190.0 );
    float fh = cfLine( ( fract( fq ) - 0.5 ) * 0.0095, 0.00035, aa * 1.5 ) * smoothstep( 0.03, 0.038, p.y ) * smoothstep( 0.072, 0.058, p.y ) * smoothstep( 0.048, 0.022, ax ) * ( 0.6 + 0.4 * sin( p.x * 120.0 + floor( fq ) * 2.0 ) );
    vec2 oc = vec2( ax - 0.047, p.y - 0.001 );
    float ca = atan( oc.y, oc.x ), cr = length( oc );
    float cf = cfLine( ( fract( ca * 7.0 / 6.2831 + 0.5 ) - 0.5 ) * cr * 0.9, 0.0003, aa * 1.5 ) * smoothstep( 0.016, 0.008, cr ) * smoothstep( 0.003, 0.006, cr ) * step( -0.003, oc.x ) * step( abs( oc.y ), 0.009 );
    // nasolabial fold: a soft crease from the nose wing to just past the mouth corner (shadow on the inner side)
    float nlx = ax - ( 0.017 + ( -p.y - 0.033 ) * 0.33 + pow( max( -p.y - 0.033, 0.0 ) / 0.03, 2.0 ) * 0.006 );
    float nlf = exp( -pow( ( nlx + 0.0007 ) / 0.0019, 2.0 ) ) * smoothstep( -0.03, -0.037, p.y ) * smoothstep( -0.063, -0.054, p.y );
    float bag = cfLine( e.y - yl + 0.0045 + 0.0015 * ex2, 0.0006, aa * 2.0 ) * smoothstep( 0.95, 0.4, abs( ex ) );
    float wr = clamp( fh * 0.8 + cf * 0.5 + nlf * 0.75 + bag * 0.8, 0.0, 1.0 ) * uWrinkle;
    c *= 1.0 - wr * 0.32;
    cfBumpH = -( fh * 0.7 + cf * 0.7 + nlf * 1.5 + bag * 1.2 ) * uWrinkle * 0.0007;
    float spots = smoothstep( 0.78, 0.86, cfN3( p * 260.0 ) ) * smoothstep( 0.02, 0.04, p.y + 0.01 );
    c *= 1.0 - spots * 0.18 * uWrinkle;
    // grey stubble over the jaw, chin and upper lip (not the lips)
    float stub = smoothstep( -0.033 + max( ax - 0.045, 0.0 ) * 0.5, -0.045 + max( ax - 0.045, 0.0 ) * 0.5, p.y ) * smoothstep( -0.012, 0.03, p.z ) * smoothstep( 0.068, 0.056, ax ) * ( 1.0 - smoothstep( 0.2, 0.6, lm ) );
    float sdots = smoothstep( 0.52, 0.85, cfN3( p * 1100.0 ) );
    // painted moustache: grey strokes from under the nose drooping to the mouth corners
    float mtop = -0.0385 - 0.004 * pow( ax / 0.022, 2.0 ), mbot = -0.0462 - 0.009 * pow( ax / 0.024, 2.0 );
    float mous = smoothstep( 0.0262, 0.022, ax ) * smoothstep( mtop + 0.0012, mtop - 0.0008, p.y ) * smoothstep( mbot - 0.001, mbot + 0.0008, p.y ) * smoothstep( 0.075, 0.085, p.z );
    float mstr = 0.45 + 0.55 * cfN3( vec3( ax * 1400.0 + p.y * 300.0 * sign( p.x ), p.y * 220.0, 3.0 ) );
    c = mix( c, mix( vec3( 0.16, 0.15, 0.14 ), vec3( 0.42, 0.41, 0.4 ), cfN3( p * 1500.0 ) ), mous * mstr * uWrinkle * 0.85 );
    c = mix( c, c * vec3( 0.8, 0.8, 0.83 ), stub * 0.55 * uWrinkle );
    c = mix( c, vec3( 0.6, 0.59, 0.57 ), stub * sdots * 0.5 * uWrinkle );
    // a sparse grey tuft on the chin
    float goat = exp( -( pow( ax / 0.013, 2.0 ) + pow( ( p.y + 0.079 ) / 0.013, 2.0 ) ) ) * smoothstep( 0.03, 0.06, p.z );
    float gstr = smoothstep( 0.3, 0.7, cfN3( vec3( ax * 900.0, p.y * 260.0, p.z * 600.0 ) ) );
    c = mix( c, vec3( 0.56, 0.55, 0.53 ), goat * ( 0.35 + 0.4 * gstr ) * uWrinkle );
  }
  diffuseColor.rgb = c;
}
if ( vFace.w < -0.5 ) diffuseColor.rgb *= 1.0 + vFace.z * 0.08;
${FADE_FRAG}
`;
const SKIN_ROUGH = `
#include <roughnessmap_fragment>
roughnessFactor = mix( roughnessFactor, 0.12, cfEye );
roughnessFactor = mix( roughnessFactor, 0.4, cfLipM * 0.8 );
if ( vFace.w < -0.5 ) roughnessFactor = mix( roughnessFactor, 0.32, vFace.z );
`;
const SKIN_BUMP = `
#include <normal_fragment_maps>
if ( cfBumpH != 0.0 ) {
  vec3 sX = dFdx( - vViewPosition ), sY = dFdy( - vViewPosition );
  vec3 r1 = cross( sY, normal ), r2 = cross( normal, sX );
  float det = dot( sX, r1 );
  vec3 gr = sign( det ) * ( dFdx( cfBumpH ) * r1 + dFdy( cfBumpH ) * r2 );
  normal = normalize( abs( det ) * normal - gr );
}
`;

export function skinMaterial(U, o = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.roughness ?? 0.66, metalness: 0 });
  m.name = 'hero-skin';
  const key = 'hero-skin-v3';
  m.onBeforeCompile = sh => {
    for (const k of ['uGaze', 'uLid', 'uIris', 'uBrow', 'uLip', 'uWrinkle', 'uMouth', 'uBrowW', 'uEyeH', 'uSmile', 'uFade', 'uRim']) sh.uniforms[k] = U[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aFace;\nvarying vec4 vFace;\nvarying vec3 vFadeP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFace = aFace; vFadeP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uRim;\n' + SKIN_FRAG_PARS)
      .replace('#include <emissivemap_fragment>', RIM(false))
      .replace('#include <color_fragment>', SKIN_FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', SKIN_ROUGH)
      .replace('#include <normal_fragment_maps>', SKIN_BUMP)
      .replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + wrapDirect('RE_Direct_Skin', 'vec3( 0.5, 0.26, 0.2 )'))
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FIGURE_MARK);
  };
  m.customProgramCacheKey = () => key + '-m';
  m.cf = { depth: fadeDepth(U, 'skin', false), dist: fadeDepth(U, 'skin', true) };
  return m;
}

// depth / distance materials that honour the dissolve (for meshes without other alpha)
function fadeDepth(U, tag, distance) {
  const dm = distance ? new THREE.MeshDistanceMaterial() : new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  dm.onBeforeCompile = sh => {
    sh.uniforms.uFade = U.uFade;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFadeP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFadeP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + NOISE + FADE_PARS).replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n' + FADE_DEPTH);
  };
  dm.customProgramCacheKey = () => 'hero-fade-depth-' + tag + (distance ? 'd' : '');
  return dm;
}
export { fadeDepth };

// --------------------------------------------------------------------------------------------- hair
const HAIR_VERT_PARS = `
attribute vec3 aHairT;
attribute vec4 aHair;
varying vec3 vHairT;
varying vec4 vHair;
varying vec3 vFadeP;
`;
const HAIR_FRAG_PARS = `
varying vec3 vHairT;
varying vec4 vHair;
${NOISE}
${FADE_PARS}
uniform vec4 uKK;
uniform vec3 uKKShift;
uniform vec3 uKKTint;
void RE_Direct_Hair( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  vec3 L = directLight.direction, V = geometryViewDir, N = geometryNormal;
  float nl = dot( N, L );
  // a modest wrap only: lit locks against shadowed ones (silver hair must not flatten into a white sheet)
  float diff = clamp( ( nl + 0.4 ) / 1.4, 0.0, 1.0 );
  diff *= diff * ( 3.0 - 2.0 * diff );
  // silver hair keeps its own colour under strongly coloured light (fire), so it is not read as flame
  vec3 lc = directLight.color;
  lc = mix( vec3( dot( lc, vec3( 0.3, 0.59, 0.11 ) ) ), lc, 0.6 );
  reflectedLight.directDiffuse += diff * 0.8 * lc * BRDF_Lambert( material.diffuseColor );
  vec3 T = normalize( vHairT );
  vec3 H = normalize( L + V );
  float jit = ( vHair.w - 0.5 ) * uKKShift.z;
  vec3 T1 = normalize( T + N * ( uKKShift.x + jit ) );
  vec3 T2 = normalize( T + N * ( uKKShift.y + jit ) );
  float th1 = dot( T1, H ), th2 = dot( T2, H );
  float s1 = pow( sqrt( max( 1.0 - th1 * th1, 0.0 ) ), uKK.y );
  float s2 = pow( sqrt( max( 1.0 - th2 * th2, 0.0 ) ), uKK.w );
  float vis = smoothstep( -0.25, 0.35, nl );
  // (narrow, moderate highlights that land at different heights on different locks: no white sheet in the sun)
  vec3 spec = vec3( s1 * uKK.x * 0.55 ) + uKKTint * material.diffuseColor * s2 * uKK.z * 0.75;
  reflectedLight.directSpecular += lc * spec * vis * ( 0.6 + 0.4 * vHair.z );
}
#undef RE_Direct
#define RE_Direct RE_Direct_Hair
void RE_IndirectDiffuse_Hair( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  // multiple scattering inside the hair volume lifts the indirect term
  // (partly desaturated so strands in shadow do not turn sky-blue)
  vec3 irr = mix( vec3( dot( irradiance, vec3( 0.3, 0.59, 0.11 ) ) ), irradiance, 0.15 );
  reflectedLight.indirectDiffuse += irr * BRDF_Lambert( material.diffuseColor ) * 1.5;
}
#undef RE_IndirectDiffuse
#define RE_IndirectDiffuse RE_IndirectDiffuse_Hair
// the environment (sky) light: three applies scene.environmentIntensity and routes the IBL diffuse through here, so
// hair gets its own: a mostly grey fill (no blue hair in shade) and only a faint sheen of reflection
void RE_IndirectSpecular_Hair( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  vec3 irr = mix( vec3( dot( irradiance, vec3( 0.3, 0.59, 0.11 ) ) ), irradiance, 0.2 );
  reflectedLight.indirectDiffuse += irr * RECIPROCAL_PI * material.diffuseColor * 1.25;
  vec3 rad = mix( vec3( dot( radiance, vec3( 0.3, 0.59, 0.11 ) ) ), radiance, 0.3 );
  reflectedLight.indirectSpecular += rad * 0.025;
}
#undef RE_IndirectSpecular
#define RE_IndirectSpecular RE_IndirectSpecular_Hair
`;

export function hairMaterial(tex, U) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, map: tex.hair, alphaTest: 0.38, alphaToCoverage: true, side: THREE.DoubleSide,
    roughness: 0.72, metalness: 0, envMapIntensity: 0.15,
  });
  m.name = 'hero-hair';
  m.onBeforeCompile = sh => {
    sh.uniforms.uKK = U.uKK; sh.uniforms.uKKShift = U.uKKShift; sh.uniforms.uKKTint = U.uKKTint; sh.uniforms.uFade = U.uFade; sh.uniforms.uRim = U.uRim;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + HAIR_VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHairT = normalize( normalMatrix * aHairT ); vHair = aHair; vFadeP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n#define HERO_HAIR\nuniform vec4 uRim;')
      .replace('#include <emissivemap_fragment>', RIM(true))
      .replace('#include <map_fragment>', '#include <map_fragment>\nif ( vHair.x > 0.5 ) diffuseColor.a = 1.0;\n' + FADE_FRAG)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );')
      .replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + HAIR_FRAG_PARS)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= 1.1;');
  };
  m.customProgramCacheKey = () => 'hero-hair-v4';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex.hair, alphaTest: 0.38 });
  const dist = new THREE.MeshDistanceMaterial({ map: tex.hair, alphaTest: 0.38 });
  for (const dm of [depth, dist]) {
    dm.onBeforeCompile = sh => {
      sh.uniforms.uFade = U.uFade;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aHair;\nvarying float vOpq;\nvarying vec3 vFadeP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOpq = aHair.x; vFadeP = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vOpq;\n' + NOISE + FADE_PARS)
        .replace('#include <alphatest_fragment>', 'if ( vOpq > 0.5 ) diffuseColor.a = 1.0;\n#include <alphatest_fragment>\n' + FADE_DEPTH);
    };
    dm.customProgramCacheKey = () => 'hero-hair-depth-v2' + (dm.isMeshDistanceMaterial ? 'd' : '');
  }
  return { mat: m, depth, dist };
}

// --------------------------------------------------------------------------------------------- villagers
// One material for a whole villager (skin, clothes, hair, hats, armour, props): vertex colour carries shading only,
// the colour comes from a per-person palette indexed by aCloth.x (slot), detail from the shared cloth texture.
// slots: 0 robe 1 sash 2 pants 3 wraps 4 shoes 5 leather 6 under/collar 7 hair 8 straw 9 metal 10 wood 11 banner
//        12 scarf 13 beard 14 skin
const VILLAGER_FRAG_PARS = `
varying vec4 vCloth;
varying vec4 vFace;
varying vec3 vBind;
uniform vec3 uPal[15];
uniform float uKid;
${NOISE}
${FADE_PARS}
float cfMetal = 0.0, cfRough = 0.9;
`;
const VILLAGER_FRAG_MAP = `
{
  int ty = int( vCloth.x + 0.5 );
  vec4 det = texture2D( map, vMapUv );
  vec3 base = uPal[ 0 ];
  for ( int i = 1; i < 15; i ++ ) if ( i == ty ) base = uPal[ i ];
  vec3 c = diffuseColor.rgb * base;
  vec3 q = vBind;
  if ( ty <= 2 || ty == 6 || ty == 11 || ty == 12 ) {
    float d = ( ty == 1 || ty == 2 ) ? det.g : det.r;
    c *= 0.72 + 0.36 * d;
    float n1 = cfN3( q * 6.0 + vCloth.w * 11.0 ), n3 = cfN3( q * 2.3 + 7.0 );
    c *= 1.0 + 0.1 * smoothstep( 0.55, 0.85, n1 );
    c = mix( c, c * vec3( 0.7, 0.64, 0.58 ), smoothstep( 0.55, 0.95, n3 ) * 0.4 );
    cfRough = 0.93;
  } else if ( ty == 3 ) {
    vec2 w = vec2( vMapUv.x * 3.0, vMapUv.y * 0.95 );
    float s1 = fract( w.x + w.y ), s2 = fract( w.x - w.y );
    float e = mix( min( s1, 1.0 - s1 ), min( s2, 1.0 - s2 ), mod( floor( w.x + w.y ) + floor( w.x - w.y ), 2.0 ) );
    c *= 0.55 + 0.45 * smoothstep( 0.0, 0.09, e );
  } else if ( ty == 7 || ty == 13 ) {
    // hair: fine streaks along the strand direction (v), soft sheen comes from low roughness
    float st = cfN3( vec3( vMapUv.x * 90.0, vMapUv.y * 4.0, vCloth.w * 9.0 ) ) * 0.6 + cfN3( vec3( vMapUv.x * 260.0, vMapUv.y * 9.0, 1.0 ) ) * 0.4;
    c *= 0.72 + 0.5 * st;
    cfRough = 0.55;
  } else if ( ty == 8 ) {
    float wv = sin( vMapUv.x * 220.0 ) * sin( vMapUv.y * 160.0 );
    c *= 0.8 + 0.25 * wv + 0.15 * ( det.r - 0.5 );
    cfRough = 0.85;
  } else if ( ty == 9 ) {
    // lamellar: rows of small overlapping plates, laced
    vec2 g = vec2( vMapUv.x * 34.0, vMapUv.y * 18.0 );
    g.x += floor( g.y ) * 0.5;
    vec2 f = fract( g );
    float edge = smoothstep( 0.0, 0.08, f.x ) * smoothstep( 1.0, 0.92, f.x ) * smoothstep( 0.0, 0.14, f.y );
    float lace = 1.0 - smoothstep( 0.04, 0.0, abs( f.y - 0.72 ) ) * 0.5;
    c *= ( 0.45 + 0.55 * edge ) * lace * ( 0.85 + 0.3 * cfN3( vec3( floor( g ), 1.0 ) ) );
    cfMetal = 0.55; cfRough = 0.48;
  } else if ( ty == 10 ) {
    c *= 0.7 + 0.5 * det.b;
    cfRough = 0.7;
  } else if ( ty == 4 || ty == 5 ) {
    c *= 0.85 + 0.3 * det.b;
    cfRough = 0.8;
  } else if ( ty == 14 ) {
    cfRough = 0.66;
    if ( vFace.w > 0.5 ) {
      vec3 p = vFace.xyz;
      float ax = abs( p.x );
      float aa = max( fwidth( p.y ), fwidth( p.x ) ) * 1.2 + 1e-6;
      float front = smoothstep( 0.045, 0.065, p.z );
      vec2 e = vec2( ( ax - 0.031 ) / 0.0135, p.y );
      float ex2 = clamp( 1.0 - e.x * e.x, 0.0, 1.0 );
      float yu = 0.0042 * pow( ex2, 0.6 ) + 0.001 * e.x, yl = -0.0032 * pow( ex2, 0.8 );
      float eye = smoothstep( -aa, aa, yu - e.y ) * smoothstep( -aa, aa, e.y - yl ) * step( abs( e.x ), 1.0 ) * front;
      vec3 ec = mix( vec3( 0.75, 0.72, 0.68 ), vec3( 0.12, 0.09, 0.08 ), smoothstep( 0.0062, 0.0048, length( vec2( ax - 0.031, p.y ) ) ) );
      c = mix( c, ec, eye );
      float lash = ( 1.0 - smoothstep( 0.0006, 0.0006 + aa, abs( e.y - yu - 0.0004 ) ) ) * step( abs( e.x ), 1.1 ) * front;
      c = mix( c, vec3( 0.05 ), lash * 0.9 );
      float bt = clamp( ( ax - 0.012 ) / 0.044, 0.0, 1.0 );
      float yb = 0.0165 + 0.004 * sin( bt * 2.5 );
      float brow = ( 1.0 - smoothstep( mix( 0.0019, 0.0008, bt ), mix( 0.0019, 0.0008, bt ) + aa, abs( p.y - yb ) ) ) * step( 0.011, ax ) * step( ax, 0.057 ) * front;
      c = mix( c, uPal[ 13 ] * 0.55, brow * 0.85 );
      float ml = ( 1.0 - smoothstep( 0.0006, 0.0006 + aa, abs( p.y + 0.0533 + 0.001 * pow( ax / 0.018, 2.0 ) ) ) ) * step( ax, 0.017 ) * smoothstep( 0.07, 0.08, p.z );
      c = mix( c, vec3( 0.32, 0.17, 0.15 ), ml * 0.75 );
      float lip = smoothstep( 1.0, 0.6, length( vec2( ax / 0.016, ( p.y + 0.055 ) / 0.008 ) ) ) * smoothstep( 0.068, 0.078, p.z );
      c = mix( c, c * vec3( 1.05, 0.78, 0.74 ), lip * 0.5 );
      c = mix( c, c * vec3( 1.04, 0.84, 0.8 ), 0.25 * exp( -( pow( ( ax - 0.042 ) / 0.016, 2.0 ) + pow( ( p.y + 0.024 ) / 0.014, 2.0 ) ) ) * front );
      cfRough = mix( cfRough, 0.2, eye );
    }
  }
  diffuseColor.rgb = c;
  ${FADE_FRAG}
}
`;
export function villagerMaterial(tex, U) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.cloth, normalMap: tex.clothN, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  m.name = 'villager';
  m.onBeforeCompile = sh => {
    sh.uniforms.uPal = U.uPal; sh.uniforms.uFade = U.uFade; sh.uniforms.uKid = U.uKid;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aCloth;\nattribute vec4 aFace;\nvarying vec4 vCloth;\nvarying vec4 vFace;\nvarying vec3 vBind;\nvarying vec3 vFadeP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloth = aCloth; vFace = aFace; vBind = position; vFadeP = position;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\ntransformed.y = max( transformed.y, 0.003 );');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + VILLAGER_FRAG_PARS)
      .replace('#include <map_fragment>', VILLAGER_FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = cfRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = cfMetal;')
      .replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + wrapDirect('RE_Direct_Villager', 'vec3( 0.32 )'))
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FIGURE_MARK);
  };
  m.customProgramCacheKey = () => 'hero-villager-v2';
  m.cf = { depth: fadeDepth(U, 'villager', false), dist: fadeDepth(U, 'villager', true) };
  return m;
}
