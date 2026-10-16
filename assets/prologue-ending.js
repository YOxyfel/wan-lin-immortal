import * as T from 'three';
import {surfaceTexture} from './village-scene.js';
export const SHOWCASE_DURATION=18500,ENDING_DURATION=13500;
const ease=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};

// The same rigid manuscript, rollers and grip points survive the entire shot.
export function createEnding(stage){
 const host=document.createElement('section');host.className='awakening';host.setAttribute('aria-label','The discovery of the ancient scroll');
 host.innerHTML='<div class="awakening-landscape"></div><canvas class="awakening-canvas" aria-hidden="true"></canvas><div class="awakening-sun"></div><div class="awakening-curtain"></div>';stage.appendChild(host);
 const forest=new URL('../Images/Prologue/runtime/forest-clean.webp',import.meta.url).href;
 const fragments=[],missing=new Set([0,5,7,22]),order=[14,15,8,9,20,21,13,16,2,3,10,11,12,17,18,19,1,4,6,23];
 for(let i=0;i<24;i++){if(missing.has(i))continue;const node=document.createElement('div'),row=Math.floor(i/6),col=i%6;node.className='awakening-fragment';node.style.backgroundImage=`url("${forest}")`;node.style.clipPath=`inset(${row*25}% ${100-(col+1)*100/6}% ${100-(row+1)*25}% ${col*100/6}%)`;host.firstElementChild.appendChild(node);fragments.push({node,at:order.indexOf(i)*.15,seed:i})}
 const canvas=host.querySelector('canvas'),sun=host.querySelector('.awakening-sun'),curtain=host.querySelector('.awakening-curtain');
 let renderer,ready=false;
 const fallback=document.createElement('img');fallback.className='awakening-fallback-art';fallback.alt='An ancient scroll discovered among forest roots';host.insertBefore(fallback,host.querySelector('.awakening-sun'));
 function useFallback(){renderer=null;host.classList.add('awakening-fallback');canvas.hidden=true;host.firstElementChild.hidden=true;}
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();useFallback()});
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-5,5,3,-3,.01,30);camera.position.z=8;
 const actor=new T.Group();scene.add(actor);
 const wood=new T.MeshStandardMaterial({map:surfaceTexture('wood'),color:0x847051,roughness:.58}),bronze=new T.MeshStandardMaterial({color:0xac854b,metalness:.72,roughness:.3}),paperMat=new T.MeshStandardMaterial({color:0xe6d3a3,side:T.DoubleSide,roughness:1,emissive:0x000000});
 scene.add(new T.HemisphereLight(0xffe9c7,0x343d29,2));const light=new T.DirectionalLight(0xffe0a6,3);light.position.set(-3,5,7);scene.add(light);
 function roll(){const g=new T.Group();actor.add(g);const core=new T.Mesh(new T.CylinderGeometry(.09,.09,2.30,40),wood);g.add(core);for(const y of [-1.15,1.15]){const cap=new T.Mesh(new T.CylinderGeometry(.14,.14,.09,40),bronze);cap.position.y=y;g.add(cap);for(const yy of [y*.84,y*.92]){const ring=new T.Mesh(new T.TorusGeometry(.103,.014,8,40),bronze);ring.rotation.x=Math.PI/2;ring.position.y=yy;g.add(ring)}}return g}
 const left=roll(),right=roll(),wrapped=new T.Mesh(new T.CylinderGeometry(.17,.17,1.98,40),paperMat);actor.add(wrapped);
 const parchment=new T.Mesh(new T.PlaneGeometry(1,1.98,20,12),paperMat);parchment.position.z=.045;actor.add(parchment);
 const cord=new T.Mesh(new T.TorusGeometry(.178,.018,8,40),new T.MeshStandardMaterial({color:0x842c23}));cord.rotation.x=Math.PI/2;actor.add(cord);
 const loader=new T.TextureLoader(),hands=[];
 loader.load(new URL('../Images/Prologue/runtime/scroll-clean.webp',import.meta.url).href,texture=>{texture.colorSpace=T.SRGBColorSpace;texture.repeat.set(.44,.57);texture.offset.set(.28,.29);paperMat.map=texture;paperMat.needsUpdate=true});
 loader.load(new URL('../Images/Prologue/runtime/hand-reach.webp',import.meta.url).href,texture=>{
  texture.colorSpace=T.SRGBColorSpace;
  const w=2.15,h=w*texture.image.height/texture.image.width;
  for(const side of [-1,1]){const geometry=new T.PlaneGeometry(w,h);geometry.translate((.5-.235)*w,(.235-.5)*h,0);const material=new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.12,depthWrite:false,toneMapped:false});const hand=new T.Mesh(geometry,material);hand.scale.x=side;actor.add(hand);hand.renderOrder=3;hands.push({hand,side})}
  ready=true;
 });
 try{renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1}catch(error){useFallback();console.warn('Discovery illustration fallback',error);}
 let width=0,height=0;
 function hide(){host.style.visibility='hidden';host.style.opacity='0'}hide();
 function update(milliseconds){
  const t=milliseconds/1000;host.style.visibility='visible';host.style.opacity='1';
  for(const {node,at,seed}of fragments){const a=ease(at,at+.45,t),v=(1-ease(at+.15,at+1.2,t))*a;node.style.opacity=String(a*(1-ease(9.3,10.4,t)));node.style.transform=`translateY(${Math.sin(t*58+seed)*v*11+(1-a)*30}px)`;node.style.filter=`brightness(${1+v*.35})`}
  const reach=ease(4.2,6.2,t),lift=ease(6.2,8,t),open=ease(8,10,t)*(1-ease(11,11.4,t));
  if(renderer){const w=host.clientWidth,h=host.clientHeight;if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);const a=w/h;camera.left=-3*a;camera.right=3*a;camera.updateProjectionMatrix()}
   actor.position.set((1-lift)*.22,-.90+lift*.30,0);actor.scale.setScalar(.60+lift*(width<700?.34:.82));actor.rotation.z=-1.05*(1-lift);actor.rotation.y=.13*(1-lift);
   left.position.x=-.12-open*1.25;right.position.x=.12+open*1.25;
   wrapped.visible=open<.13;wrapped.scale.x=wrapped.scale.z=1-open*5;
   parchment.visible=open>.01;parchment.scale.x=.20+open*2.54;if(paperMat.map){paperMat.map.repeat.x=.44*parchment.scale.x/2.74;paperMat.map.offset.x=.5-paperMat.map.repeat.x/2;}
   cord.visible=t<8;paperMat.emissive.setRGB(ease(9.4,10.4,t)*.8,ease(9.4,10.4,t)*.57,ease(9.4,10.4,t)*.25);
   for(const {hand,side}of hands){hand.visible=ready&&(side===1?t>4.2:t>7.3);const enter=side===1?reach:ease(7.3,8,t);hand.position.set(side*(.12+open*1.25)+(1-enter)*1.3,-.22-(1-enter)*4,.20);hand.scale.set(side*1.75/actor.scale.x,1.75/actor.scale.y,1);hand.rotation.z=-actor.rotation.z;hand.material.opacity=side===1?ease(4.2,4.7,t):ease(7.3,7.7,t)}
   actor.visible=t<11.6;canvas.style.opacity=String(ease(0,.7,t));renderer.render(scene,camera);
  }
  if(!renderer){const expanded=t>=8&&t<11.6;fallback.src=new URL(expanded?'../Images/Prologue/runtime/scroll-clean.webp':'../Images/Prologue/runtime/forest.webp',import.meta.url).href;fallback.classList.toggle('expanded',expanded);fallback.style.opacity=String(1-ease(11.6,12.5,t));}
  host.dataset.openAmount=open.toFixed(2);
  sun.style.opacity=String(ease(9.4,10.4,t)*(1-ease(10.9,11.35,t)));sun.style.transform=`scale(${.5+ease(9.2,10.4,t)*2})`;
  curtain.style.opacity=String(ease(10.15,10.65,t)*(1-ease(10.8,11.25,t))+ease(11.8,12.5,t));curtain.style.background=t<11.5?'#fff8dd':'#e9e2d1';
  host.dataset.shot=t<4.2?'fragments':t<6.2?'reach':t<8?'lift':t<10.4?'opening':t<11?'sun':t<11.6?'closing':'demo';
 }
 return {update,hide};
}
