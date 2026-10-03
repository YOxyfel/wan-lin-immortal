import * as T from 'three';
(async()=>{
const canvas=document.querySelector('#world'),root=document.querySelector('#prologue');
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer,progress=0,visual=0,shockAt=-1,armed=true,introStart=performance.now(),frame,ready=false,paused=false;
const metrics={frames:0,frameTimes:[],ready:false,motionSource:'Higgsfield Genjutsu free motion transfer'};
window.studyMetrics=metrics;
const imageLoader=new T.TextureLoader();
async function texture(path){const t=await imageLoader.loadAsync(path);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
const video=document.createElement('video');video.src='Images/Prologue/runtime/walk.mp4';video.muted=true;video.playsInline=true;video.preload='auto';
async function makeAtlas(){
 await Promise.race([new Promise((ok,no)=>{video.addEventListener('loadeddata',ok,{once:true});video.addEventListener('error',no,{once:true});video.load();}),new Promise((_,no)=>setTimeout(()=>no(new Error('Motion load timeout')),15000))]);
 const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=2048;const ctx=atlas.getContext('2d');
 // Only the central character region is packed, retaining detail without the empty green margins.
 for(let i=0;i<32;i++){
  const time=.03+(video.duration-.10)*i/32;
  await new Promise(ok=>{video.addEventListener('seeked',ok,{once:true});video.currentTime=time;});
  const sx=video.videoWidth*.26,sw=video.videoWidth*.48;
  ctx.drawImage(video,sx,0,sw,video.videoHeight,(i%8)*256,Math.floor(i/8)*512,256,512);
 }
 const t=new T.CanvasTexture(atlas);t.colorSpace=T.SRGBColorSpace;t.minFilter=T.LinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=false;
 metrics.video={width:video.videoWidth,height:video.videoHeight,duration:video.duration,frames:32};return t;
}
function getProgress(){progress=clamp((window.prologueProgress||0)/.38);}
try{
 renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setClearColor(0xc6d8df);renderer.outputColorSpace=T.SRGBColorSpace;
 const [peace,attack,fore,atlas,rear]=await Promise.all([texture('Images/Prologue/runtime/village-peace.webp'),texture('Images/Prologue/runtime/village-attack.webp'),texture('Images/Prologue/runtime/foreground.webp'),makeAtlas(),texture('Images/Prologue/runtime/shoulder.webp')]);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,100);camera.position.z=12;
 const uniforms={peace:{value:peace},attack:{value:attack},reveal:{value:0},intro:{value:0}};
 const backdrop=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({uniforms,vertexShader:'varying vec2 uv0; void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
  uniform sampler2D peace;uniform sampler2D attack;uniform float reveal;uniform float intro;varying vec2 uv0;
  float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){vec2 sky=vec2(mix(.34,.66,uv0.x),mix(.77,.96,uv0.y));vec2 uv=mix(sky,uv0,intro);vec4 day=texture2D(peace,uv);vec4 ink=texture2D(attack,uv);float threshold=uv.x*.73+noise(floor(uv*vec2(90.,48.)))*.12+.06;float mask=reveal<=0.?0.:(reveal>=1.?1.:1.-smoothstep(reveal-.045,reveal+.045,threshold));gl_FragColor=mix(day,ink,mask);#include <colorspace_fragment>}
 `.replace('#include','\n#include').replace('fragment>}','fragment>\n}') }));
 backdrop.position.z=-2;scene.add(backdrop);
 const charUniforms={map:{value:atlas},tile:{value:0},alpha:{value:1},ink:{value:0}};
 const actor=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:charUniforms,vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 uniform sampler2D map;uniform float tile;uniform float alpha;uniform float ink;varying vec2 uv0;
 void main(){vec2 uv=vec2((mod(tile,8.)+uv0.x)/8.,(3.-floor(tile/8.)+uv0.y)/4.);vec4 c=texture2D(map,uv);float green=c.g-max(c.r,c.b);float key=1.-smoothstep(.08,.25,green);if(key<.02)discard;c.g=min(c.g,max(c.r,c.b)+.015);float l=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(c.rgb,vec3(l*.85),ink);gl_FragColor=vec4(c.rgb,key*alpha);#include <colorspace_fragment>}
 `.replace('#include','\n#include').replace('fragment>}','fragment>\n}') }));scene.add(actor);actor.position.z=2;actor.scale.set(2.8,5.6,1);
 const foreground=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:fore,transparent:true,depthWrite:false}));foreground.position.z=4;scene.add(foreground);
 const shoulder=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:rear,transparent:true,depthWrite:false}));shoulder.position.z=2.1;scene.add(shoulder);
 const shade=document.createElement("canvas");shade.width=128;shade.height=64;const sc=shade.getContext("2d"),gradient=sc.createRadialGradient(64,32,0,64,32,60);gradient.addColorStop(0,"rgba(35,31,24,.35)");gradient.addColorStop(1,"rgba(35,31,24,0)");sc.fillStyle=gradient;sc.fillRect(0,0,128,64);const shadow=new T.Mesh(new T.PlaneGeometry(1.9,.30),new T.MeshBasicMaterial({map:new T.CanvasTexture(shade),transparent:true,depthWrite:false}));shadow.position.z=1.8;scene.add(shadow);
 const specks=new T.BufferGeometry(),coords=[];for(let i=0;i<32;i++)coords.push((Math.sin(i*7.31)*9),Math.cos(i*3.17)*6,1+Math.sin(i)*2);
 specks.setAttribute('position',new T.Float32BufferAttribute(coords,3));const embers=new T.Points(specks,new T.PointsMaterial({color:0xb02718,size:.035,transparent:true,opacity:0,depthWrite:false}));scene.add(embers);
 function resize(){const dpr=Math.min(devicePixelRatio,1.5,Math.sqrt(4500000/(innerWidth*innerHeight)));renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  const h=2*14*Math.tan(Math.PI/9);const bh=Math.max(h,h*camera.aspect/(peace.image.width/peace.image.height))*1.10;backdrop.scale.set(bh*peace.image.width/peace.image.height,bh,1);
  const fh=2*8*Math.tan(Math.PI/9)*1.16;foreground.scale.set(fh*camera.aspect,fh,1);getProgress();
 }
 let last=performance.now();
 function paint(now){
  frame=requestAnimationFrame(paint);if(document.hidden||paused||window.prologueProgress>.395)return;
  const dt=Math.min((now-last)/1000,.06);last=now;getProgress();
  if(progress<.51){armed=true;shockAt=-1;}
  if(armed&&progress>=.52&&visual<.52&&!reduced){shockAt=now;armed=false;}
  const shock=shockAt<0?1:clamp((now-shockAt)/1900);
  visual=mix(visual,progress,1-Math.exp(-dt*16));if(Math.abs(progress-visual)<.0001)visual=progress;
  if(progress>.78)shockAt=-1;
  const p=visual,intro=progress>.025?1:smooth(0,4,(now-introStart)/1000);
  uniforms.intro.value=reduced?1:intro;
  const walk=smooth(.06,.50,p),turn=smooth(.52,.72,p);
  const attackProgress=progress>=.52&&shock<1?mix(.04,1,shock):(shockAt>=0&&progress>=.52?1:smooth(.51,.70,p));
  uniforms.reveal.value=attackProgress;
  const mobile=innerWidth<700;camera.position.x=mix(mobile?-5.5:-1.6,mobile?6:2.6,walk)*(1-turn)+mix(mobile?6:2.6,mobile?-3:-1.3,turn)*turn;
  camera.position.y=0;camera.rotation.set(0,Math.sin(turn*Math.PI)*.025,0);
  const tremor=shock<1?Math.sin(shock*Math.PI)*.027:0;camera.position.x+=Math.sin(now*.073)*tremor;camera.position.y+=Math.sin(now*.097)*tremor;
  actor.position.x=camera.position.x+mix(-1.0,.05,walk);actor.position.y=-1.25;actor.scale.set(mobile?2.8:3.2,mobile?3.3:3.75,1);
  charUniforms.tile.value=Math.floor(walk*96)%32;charUniforms.alpha.value=smooth(.2,.8,intro)*(1-smooth(.32,.40,p));charUniforms.ink.value=smooth(.51,.64,p);
  actor.visible=charUniforms.alpha.value>.01;shadow.position.set(actor.position.x,actor.position.y-actor.scale.y/2+.14,1.8);shadow.material.opacity=charUniforms.alpha.value;const over=smooth(.34,.49,p),rearAlpha=smooth(.33,.40,p)*(1-smooth(.47,.535,p));shoulder.material.opacity=rearAlpha;shoulder.visible=rearAlpha>.01;const sh=mix(4.6,8.3,over);shoulder.scale.set(sh*rear.image.width/rear.image.height,sh,1);shoulder.position.x=camera.position.x+mix(-.4,-2.4,over);shoulder.position.y=-1.4;
  foreground.position.x=camera.position.x*.15;foreground.rotation.z=reduced?0:Math.sin(now*.00045)*.0015;foreground.material.color.set(0xffffff).lerp(new T.Color(0x38332d),attackProgress*.8);
  embers.material.opacity=smooth(.58,.72,p)*.7;embers.position.y=((now/1000)%6)*.15;embers.rotation.z=now*.00003;
  renderer.render(scene,camera);metrics.frames++;if(metrics.frameTimes.length<12000)metrics.frameTimes.push(dt*1000);
  canvas.dataset.progress=p.toFixed(4);canvas.dataset.shock=String(shock<1);canvas.dataset.frame=String(charUniforms.tile.value);
 }
 addEventListener('resize',resize,{passive:true});addEventListener('pageshow',()=>{getProgress();visual=progress;shockAt=-1;});document.addEventListener('visibilitychange',()=>{last=performance.now();});
 document.querySelector('#replay').addEventListener('click',()=>{scrollTo(0,0);progress=visual=0;introStart=performance.now();shockAt=-1;armed=true;});
 resize();visual=progress;introStart=performance.now();ready=metrics.ready=true;document.querySelector('#loading').classList.add('loaded');root.dataset.ready='true';requestAnimationFrame(paint);
 window.study={seek(p){scrollTo(0,p*(root.offsetHeight-innerHeight));getProgress();visual=progress;shockAt=-1;},pause(){paused=true;},resume(){paused=false;last=performance.now();}};
}catch(error){document.body.classList.add('failed');root.dataset.ready='fallback';document.querySelector('#loading').classList.add('loaded');metrics.error=String(error);console.error(error);}
document.querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(a!==b)b.pause();})));

})();