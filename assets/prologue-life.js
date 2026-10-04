import * as T from 'three';

const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment=`
precision highp float;
varying vec2 vUv;
uniform sampler2D art,lower,flow;
uniform vec2 crop,center;
uniform float time,kind,effort;
float hash(float n){return fract(sin(n*127.1)*43758.5453);}
float bell(vec2 p,vec2 c,vec2 radius){vec2 d=(p-c)/radius;return exp(-dot(d,d)*2.);}
vec2 sway(vec2 q){
 float wind=sin(time*1.25)+sin(time*2.1)*.32;
 if(kind<.5){q.x+=wind*.008*smoothstep(.1,.95,q.y)*(1.-smoothstep(.22,.46,q.x));q.x+=sin(time*1.9+q.x*7.)*.005*(1.-smoothstep(.06,.25,q.y));}
 else if(kind<1.5){float logs=smoothstep(.43,.68,q.x)*smoothstep(.22,.7,q.y);q.x+=sin(time*1.45+q.y*4.)*.006*logs;q.y+=sin(time*2.4)*.004*bell(q,vec2(.6,.37),vec2(.30,.30));}
 else if(kind<2.5){q.x+=wind*.008*smoothstep(.3,1.,q.y)*(1.-smoothstep(.2,.4,q.x));float breath=sin(time*1.35)*.0035;q.y+=breath*bell(q,vec2(.5,.53),vec2(.4,.35));q.x+=sin(time*1.7+q.y*8.)*.004*bell(q,vec2(.5,.82),vec2(.25,.3));}
 else {float breath=sin(time*1.1)*.0025;q.y+=breath*bell(q,vec2(.62,.40),vec2(.4,.3));q.x+=sin(time*.9)*.0015*bell(q,vec2(.53,.32),vec2(.18,.18));q.x+=sin(time*1.6+q.y*8.)*.003*bell(q,vec2(.75,.77),vec2(.22,.2));}
 return q;
}
vec3 readArt(vec2 q){
 q=clamp(q,.002,.998);vec3 result=texture2D(art,q).rgb;
 if(kind<.5){vec4 motion=(texture2D(flow,q)-.5)*.70;vec2 a=clamp(q-effort*motion.xy,.002,.998),b=clamp(q-(1.-effort)*motion.zw,.002,.998);vec3 up=texture2D(art,vec2(a.x/3.,a.y)).rgb,down=texture2D(lower,vec2(b.x/3.,b.y)).rgb;result=mix(up,down,smoothstep(.42,.58,effort));}
 else if(kind<2.5)result=texture2D(art,vec2((q.x+kind)/3.,q.y)).rgb;
 return result;
}
float tongue(vec2 q,vec2 origin,float width,float height,float seed){
 vec2 p=(q-origin)/vec2(width,height);float y=p.y;if(y<0.||y>1.)return 0.;float wobble=sin(y*9.-time*(4.+seed)*1.4+seed)*.14*y+sin(y*21.-time*7.+seed)*.06;float edge=abs(p.x+wobble),w=max(.015,(1.-y)*.46);return (1.-smoothstep(w*.35,w,edge))*smoothstep(0.,.07,y)*(1.-smoothstep(.7,1.,y));
}
vec3 flames(vec2 q,vec3 col){
 float f=0.,hot=0.;
 for(int i=0;i<7;i++){float j=float(i),x,width,height,base;
  if(kind<1.5){x=.75+j*.027; base=.11; width=.10;height=.14+hash(j+4.)*.18;}
  else {x=.018+j*.048;base=.63+hash(j+3.)*.08;width=.060;height=.17+hash(j+2.)*.19;}
  float a=tongue(q,vec2(x,base),width,height,j*.8);a*=.7+.3*sin(q.y*110.-time*11.+j);if(kind>2.5){float post=1.-smoothstep(.014,.026,abs(q.x-.055));post=max(post,1.-smoothstep(.025,.037,abs(q.x-.257)));a*=(1.-post)*smoothstep(.60,.65,q.y)*(1.-smoothstep(.32,.38,q.x));}f=max(f,a);hot=max(hot,a*(1.-clamp((q.y-base)/height,0.,1.)));
 }
 float flick=.7+sin(time*12.)*.12+sin(time*19.6)*.08;vec2 firePos=kind<1.5?vec2(.85,.20):vec2(.18,.55);float glow=bell(q,firePos,kind<1.5?vec2(.30,.35):vec2(.40,.75));
 col*=1.+glow*(.11+flick*.16);col+=vec3(.32,.078,.015)*glow*flick;
 vec3 fire=mix(vec3(1.,.19,.025),vec3(1.,.80,.30),hot);col=mix(col,fire,clamp(f*(kind>2.5?.48:.68),0.,1.));
 for(int i=0;i<22;i++){float j=float(i),age=fract(time*(.12+hash(j)*.17)+hash(j+8.)),x=firePos.x+(hash(j+9.)-.5)*.36+sin(age*4.+j)*.028,y=firePos.y+age*.65;float a=bell(q,vec2(x,y),vec2(.0025,.004))*(1.-age);col+=vec3(1.,.31,.06)*a*.7;}
 return col;
}
void main(){
 vec2 q=(vUv-.5)*crop+center;vec2 warped=sway(q);vec3 col=readArt(warped);
 if(kind<.5){vec2 sun=vec2(.805,.785),d=q-sun;float r=length(d),a=atan(d.y,d.x);float rays=pow(max(0.,sin(a*12.+time*.10)),9.)*exp(-r*7.);float glow=exp(-r*6.)*(.12+sin(time*1.8)*.025);col+=vec3(.9,.51,.18)*(rays*.07+glow);for(int i=0;i<16;i++){float j=float(i),x=fract(hash(j)+time*.014),y=fract(hash(j+2.)+time*.028);col+=vec3(.9,.7,.35)*bell(q,vec2(x,y),vec2(.002,.004))*.25;}}
 if(kind>.5&&kind<1.5){
  for(int i=0;i<72;i++){float j=float(i),speed=.52+hash(j+3.)*.55,y=1.-fract(time*speed+hash(j)),x=fract(hash(j+17.)-time*.075),len=.018+hash(j+5.)*.055;vec2 d=q-vec2(x,y);float streak=(1.-smoothstep(.0004,.0018,abs(d.x+d.y*.17)))*(1.-smoothstep(len*.25,len,abs(d.y)));col=mix(col,vec3(.76,.82,.80),streak*.48);float age=fract(time*1.6+hash(j+4.)),rr=length((q-vec2(hash(j+8.),.02+hash(j+11.)*.10))*vec2(1.,3.));float splash=(1.-smoothstep(.001,.003,abs(rr-age*.026)))*(1.-age)*smoothstep(.15,.25,age);col+=vec3(.21)*splash*.20;
  }col=flames(q,col);
 }
 if(kind>1.5&&kind<2.5){for(int i=0;i<9;i++){float j=float(i),x=fract(hash(j)+time*(.02+hash(j+2.)*.02)),y=1.-fract(time*.05+hash(j+4.));vec2 d=(q-vec2(x,y))/vec2(.008,.017);float angle=time*(.7+hash(j))+j;vec2 r=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d;float a=(1.-smoothstep(.6,1.,length(r)))*.6;col=mix(col,vec3(.38,.10,.05),a);}}
 if(kind>2.5){col=flames(q,col);for(int i=0;i<30;i++){float j=float(i),age=fract(time*(.045+hash(j)*.035)+hash(j+9.)),x=fract(hash(j+1.)+age*.25+sin(time*.4+j)*.025),y=age;float ash=bell(q,vec2(x,y),vec2(.002+hash(j)*.002,.004))*.55;col=mix(col,vec3(.65,.59,.51),ash);}float smoke=bell(q,vec2(.17+sin(time*.5)*.03,.56+sin(time*.3)*.09),vec2(.18,.35));col=mix(col,vec3(.12,.11,.10),smoke*(.10+sin(time*.8)*.03));}
 gl_FragColor=vec4(col,1.);
}
`;

export async function createLivingScenes(){
 const loader=new T.TextureLoader();const [art,lower,uncle,buffer]=await Promise.all([
  loader.loadAsync(new URL('../Images/Prologue/runtime/training.webp',import.meta.url).href),
  loader.loadAsync(new URL('../Images/Prologue/runtime/training-down.webp',import.meta.url).href),
  loader.loadAsync(new URL('../Images/Prologue/runtime/uncle.webp',import.meta.url).href),
  fetch(new URL('./motion/pushup-flow.bin',import.meta.url)).then(r=>{if(!r.ok)throw Error('Pose vectors failed');return r.arrayBuffer()})
 ]);
 // These illustrated textures are sampled in their existing display colour space.
 for(const t of [art,lower,uncle]){t.minFilter=T.LinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=false}
 const flow=new T.DataTexture(new Uint8Array(buffer),192,192,T.RGBAFormat);flow.magFilter=flow.minFilter=T.LinearFilter;flow.needsUpdate=true;
 const metrics=window.livingSceneMetrics={ready:false,frames:0,active:[],effects:['anatomy anchored push-ups','bamboo and log sway','radiating sun','rain and splashes','fire tongues and embers','uncle breathing and ash']};
 const descriptors=[['.strength',0],['.shelter',1],['.silence',2],['.home',3]],views=[];
 for(const [selector,kind]of descriptors){const host=document.querySelector(selector),canvas=document.createElement('canvas');canvas.className='living-art';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
  try{const renderer=new T.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));const camera=new T.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;const scene=new T.Scene();const uniforms={art:{value:kind===3?uncle:art},lower:{value:lower},flow:{value:flow},time:{value:0},kind:{value:kind},effort:{value:0},crop:{value:new T.Vector2(1,1)},center:{value:new T.Vector2(.5,.5)}};const material=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms,depthTest:false,depthWrite:false});scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));views.push({host,kind,renderer,scene,camera,uniforms,width:0,height:0});host.classList.add('living-ready');canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();host.classList.remove('living-ready');metrics.contextLost=true})}catch(e){canvas.remove();console.warn('Living illustration fallback',e)}
 }
 metrics.ready=true;
 function update(p,now){metrics.active=[];if(document.hidden)return;for(const v of views){const eligible=v.kind===3?p>.377&&p<.565:p>.525&&p<.863;if(!eligible)continue;const rect=v.host.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight||rect.right<0||rect.left>innerWidth)continue;const width=Math.round(v.host.clientWidth),height=Math.round(v.host.clientHeight);if(!width||!height)continue;if(width!==v.width||height!==v.height){v.renderer.setSize(width,height,false);v.width=width;v.height=height;const ratio=width/height,imageRatio=v.kind===3?1672/941:1;const sx=Math.min(1,ratio/imageRatio),sy=Math.min(1,imageRatio/ratio);v.uniforms.crop.value.set(sx,sy);v.uniforms.center.value.set(sx*.5+(1-sx)*(innerWidth<700?.80:.65),sy*.5+(1-sy)*.45)}
   v.uniforms.time.value=now/1000;const cycle=(now/2450+p*11)%1;const smooth=x=>x*x*(3-2*x);v.uniforms.effort.value=cycle<.43?smooth(cycle/.43):cycle<.54?1:cycle<.93?1-smooth((cycle-.54)/.39):0;v.renderer.render(v.scene,v.camera);metrics.active.push(v.kind);metrics.frames++;metrics.effort=v.uniforms.effort.value;
  }}
 return {update,metrics};
}

