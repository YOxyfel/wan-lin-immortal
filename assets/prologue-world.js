import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createVillage,createCharacter } from './village-scene.js';
const root=document.querySelector('#prologue'),canvas=document.querySelector('#world');
async function boot(){
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.65:2));renderer.setSize(innerWidth,innerHeight,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 const world=createVillage();const model=await new GLTFLoader().loadAsync(new URL('./models/village/wuhen-source.glb',import.meta.url).href);world.setCharacter(createCharacter(model.scene));
 for(const m of Object.values(world.surfaces))m.map.anisotropy=renderer.capabilities.getMaxAnisotropy();
 const metrics=window.villageMetrics=world.metrics;metrics.frames=0;metrics.frameTimes=[];window.studyMetrics=metrics;
 let last=performance.now(),paused=false,previous=0;world.reset(last);
 addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight,false);world.camera.aspect=innerWidth/innerHeight;world.camera.updateProjectionMatrix()});
 document.querySelector('#replay').addEventListener('click',()=>world.reset(performance.now()));
 document.addEventListener('visibilitychange',()=>{paused=document.hidden;last=performance.now()});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();paused=true;document.body.classList.add('failed')});canvas.addEventListener('webglcontextrestored',()=>location.reload());
 root.dataset.ready='true';document.querySelector('.loading').classList.add('loaded');
 function render(now){requestAnimationFrame(render);const p=window.prologueProgress||0;if(paused||p>.39){last=now;return}if(p<.001&&previous>=.001)world.reset(now);previous=p;world.update(p,now,innerWidth/innerHeight);renderer.render(world.scene,world.camera);metrics.frames++;if(metrics.frameTimes.length<300&&now-last<150)metrics.frameTimes.push(now-last);last=now}requestAnimationFrame(render);
}
boot().catch(error=>{root.dataset.ready='fallback';document.body.classList.add('failed');document.querySelector('.loading').classList.add('loaded');console.error('Village scene failed',error)});

