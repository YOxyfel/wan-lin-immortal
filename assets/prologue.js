import {createScrollDeparture,departurePose,DEPARTURE_DURATION,DEPARTURE_IMPACTS} from './prologue-departure.js';
const root=document.querySelector('#prologue'),stage=document.querySelector('.stage');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=s=>document.querySelector(s),clamp=x=>Math.max(0,Math.min(1,x)),lerp=(a,b,t)=>a+(b-a)*t;
const ease=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)},visible=(a,b,c,d,x)=>ease(a,b,x)*(1-ease(c,d,x));
const parts={world:$('.world-wrap'),intro:$('.intro'),attack:$('#attack-caption'),home:$('.home'),quote:$('.quote'),memory:$('.memory'),forest:$('.forest'),artifact:$('.artifact'),black:$('.blackout'),years:$('#years-caption'),find:$('#find-caption'),end:$('#end-caption')};
let p=0,target=0,story=0,last=performance.now(),start=performance.now(),sound=false,context=null,wind=null,voice=null,voicePlayed=false,footAt=0,modalY=0,codexNavigation=false;
window.prologueProgress=0;
let livingScenes=null;
if(!reduced)import("./prologue-life.js").then(m=>m.createLivingScenes()).then(scenes=>livingScenes=scenes).catch(error=>console.warn("Living scenes use static fallback",error));
const metrics=window.prologueMetrics={ready:false,chapter:'sunlight',audio:'procedural ambience; private ElevenLabs voice excluded from public build'};
const codex=$('.codex');$('#codex-open').addEventListener('click',()=>{modalY=scrollY;codex.showModal();document.body.style.overflow='hidden'});$('#codex-close').addEventListener('click',()=>codex.close());codex.addEventListener('close',()=>{document.body.style.overflow='';if(!codexNavigation)scrollTo(0,modalY);codexNavigation=false});codex.addEventListener('click',e=>{if(e.target===codex){const r=codex.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)codex.close()}});
function stopVoice(){if(voice){voice.pause();voice.currentTime=0}}
function hit(frequency,duration=.14,volume=.07){if(!context||!sound)return;const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,context.currentTime);oscillator.frequency.exponentialRampToValueAtTime(frequency*.35,context.currentTime+duration);gain.gain.setValueAtTime(volume,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);oscillator.connect(gain).connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+duration)}
$('#sound').addEventListener('click',async()=>{sound=!sound;$('#sound').textContent=sound?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(sound));if(!sound){wind?.gain.setTargetAtTime(0,context.currentTime,.2);stopVoice();return}if(!context){context=new (window.AudioContext||window.webkitAudioContext)();const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()-.5)*.35;const source=context.createBufferSource();source.buffer=buffer;source.loop=true;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=450;wind=context.createGain();wind.gain.value=.035;source.connect(filter).connect(wind).connect(context.destination);source.start();if(location.hostname==='127.0.0.1'||location.hostname==='localhost'){voice=new Audio('http://127.0.0.1:8012/audio/uncle-take-2.mp3');voice.volume=.8}}
 await context.resume();wind.gain.setTargetAtTime(.035,context.currentTime,.3);if(story>.4&&story<.52&&!voicePlayed&&voice){voicePlayed=true;voice.play().catch(()=>{})}});
const dust=$('.dust');for(let i=0;i<18;i++){const node=document.createElement('i');node.style.left=(7+(i*37)%90)+'%';node.style.top=((i*23)%95)+'%';dust.appendChild(node)}
const captions=["Don’t avenge me.","Forget about me…","Live a good life.<br>A long life.","Avenge…?<br>Those were monsters.","Unless someone<br>sent them."];
function opacity(el,value){el.style.opacity=value.toFixed(4);el.style.visibility=value>.001?'visible':'hidden'}
// Three additional viewport lengths hold the encounter; existing scenes keep their pace.
const fateStart=.85,fateLength=3/21;
const storyProgress=progress=>{const time=progress*(24/21);return time<=fateStart?time:Math.max(fateStart,time-fateLength)};
const fate=$('.fate'),fateLines=[...document.querySelectorAll('.fate-line')],fateCopy=$('.fate-copy'),magicBar=$('.fate-magic-bar'),magicTip=$('.fate-progress-tip');
const departure=$('.departure'),departureGate=fateStart*21/24;
let departurePhase='armed',departureAt=-1,departureT=0,departureRenderer=null,departureImpact=0,touchY=0;
function cancelDeparture(phase='blocked'){
 departurePhase=phase;departureAt=-1;departureT=0;departureImpact=0;opacity(departure,0);document.body.classList.remove('in-void');
}
function beginDeparture(now){
 departurePhase='playing';departureAt=now;departureT=0;departureImpact=0;
 const anchor=departureGate*(root.offsetHeight-innerHeight);scrollTo(0,anchor);p=target=departureGate;story=fateStart;
 if(!departureRenderer){try{departureRenderer=createScrollDeparture()}catch(error){departure.classList.add('departure-fallback');console.warn('Scroll departure uses CSS fallback',error)}}
}
// Pin this one automatic shot without removing the scrollbar or shifting the page.
addEventListener('wheel',event=>{if(departurePhase!=='playing')return;if(event.deltaY<0){cancelDeparture();return}event.preventDefault()},{passive:false});
addEventListener('touchstart',event=>{touchY=event.touches[0]?.clientY??0},{passive:true});
addEventListener('touchmove',event=>{if(departurePhase!=='playing')return;if((event.touches[0]?.clientY??touchY)>touchY+8){cancelDeparture();return}event.preventDefault()},{passive:false});
addEventListener('keydown',event=>{if(departurePhase!=='playing')return;if(['Escape','Home','PageUp','ArrowUp'].includes(event.key)){cancelDeparture();if(event.key==='Escape'){scrollTo(0,(departureGate-.02)*(root.offsetHeight-innerHeight));event.preventDefault()}return}if([' ','PageDown','ArrowDown','End'].includes(event.key))event.preventDefault()});
for(const link of document.querySelectorAll('a[href="#demo"]'))link.addEventListener('click',()=>cancelDeparture());
let typeIndex=-1,typeAt=0,typeExiting=false,fateEntryAt=-1,typeProgress=0;
function updateFateType(progress,now,alpha){
 const desired=progress<.33?0:progress<.67?1:2;
 if(alpha<.01){typeIndex=-1;fateEntryAt=-1;typeProgress=0;fateCopy.style.opacity='0';magicBar.style.opacity='0';for(const line of fateLines)opacity(line,0);return}
 if(fateEntryAt<0){fateEntryAt=now;typeIndex=0;typeAt=now+650;typeExiting=false}
 const entrance=ease(.65,2.65,(now-fateEntryAt)/1000);
 fateCopy.style.opacity=String(entrance);magicBar.style.opacity=String(entrance);
 // Each passage completes its entrance and reading hold before the next one.
 if(desired!==typeIndex&&!typeExiting&&(desired<typeIndex||now-typeAt>4000)){typeExiting=true;typeAt=now}
 if(typeExiting&&now-typeAt>1500){typeIndex=desired>typeIndex?typeIndex+1:desired;typeAt=now;typeExiting=false}
 const elapsed=(now-typeAt)/1000;
 fateLines.forEach((line,i)=>{
  opacity(line,i===typeIndex?alpha:0);line.style.transform='none';
  line.querySelectorAll('.fate-row').forEach((row,j)=>{const ink=typeExiting?ease(0,1.15,elapsed-j*.16):1-ease(0,1.65,elapsed-j*.35);row.style.opacity=String(1-ink);row.style.filter=`blur(${ink*(typeExiting?12:8)}px)`;row.style.transform=`translateY(${ink*(typeExiting?-20:24)}px)`;row.style.letterSpacing=`${typeExiting?ink*2:0}px`;});
 });
 const rows=fateLines[typeIndex].querySelectorAll('.fate-row').length;
 const readProgress=(typeIndex+ease(0,1.65+(rows-1)*.35,elapsed))/fateLines.length;
 typeProgress=typeExiting?(typeIndex+1)/fateLines.length:readProgress;
 magicBar.style.setProperty('--story-fill',String(typeProgress));
 const angle=typeProgress*Math.PI*2;
 magicTip.setAttribute('cx',String(500+400*Math.sin(angle)));magicTip.setAttribute('cy',String(500-400*Math.cos(angle)));magicTip.style.opacity=typeProgress>0&&typeProgress<1?'1':'0';
 fate.style.setProperty('--text-dissolve',typeExiting?Math.sin(clamp(elapsed/1.5)*Math.PI):0);
 root.dataset.fateType=String(typeIndex);root.dataset.fateTextPhase=entrance===0?'blackout':typeExiting?'dissolving':'revealing';root.dataset.fateFill=typeProgress.toFixed(4);
}
let fatePrevious=0,fateShockAt=-1,fateShockPower=0;
let wasAttack=false,shockTime=-1;
function render(now){requestAnimationFrame(render);if(document.hidden||reduced)return;const dt=Math.min(.06,(now-last)/1000);last=now;const rect=root.getBoundingClientRect();target=clamp(-rect.top/Math.max(1,root.offsetHeight-innerHeight));if(rect.bottom<0){if(departurePhase==='playing')cancelDeparture();document.body.classList.remove('in-void');return}p=lerp(p,target,1-Math.exp(-dt*17));if(Math.abs(p-target)<.00005)p=target;if(p<departureGate-.016&&departurePhase!=='armed')cancelDeparture('armed');
 if(departurePhase==='armed'&&p>=departureGate-.0001&&!codex.open)beginDeparture(now);
 if(departurePhase==='playing'){
  p=target=departureGate;departureT=clamp((now-departureAt)/DEPARTURE_DURATION);
  if(departureT>=1)departurePhase='complete';
 }
 story=storyProgress(p);window.prologueProgress=story;root.dataset.progress=story.toFixed(4);root.dataset.journeyProgress=p.toFixed(4);
 const timeline=p*(24/21),fateProgress=clamp((timeline-fateStart)/fateLength),fateOpacity=departurePhase==='complete'?visible(fateStart-.003,fateStart,fateStart+fateLength+.008,fateStart+fateLength+.034,timeline):0;
 opacity(fate,fateOpacity);fate.style.setProperty('--night',1);fate.classList.add('dark');
 updateFateType(fateProgress,now,fateOpacity);
 for(const [at,power]of [[.35,3.5],[.69,5]])if(fatePrevious<at&&fateProgress>=at&&fateOpacity>.2&&fateProgress<.97){fateShockAt=now;fateShockPower=power;hit(at<.5?76:48,.35,.045)}
 fatePrevious=fateProgress;const impact=fateShockAt<0?0:Math.max(0,1-(now-fateShockAt)/380),strength=impact*impact*fateShockPower*(innerWidth<700?.6:1);
 fate.style.translate=`${Math.sin(now*.094)*strength}px ${Math.cos(now*.127)*strength*.65}px`;fate.style.setProperty('--impact',impact.toFixed(3));
 const intro=target>.004?1:ease(0,3.5,(now-start)/1000);opacity(parts.intro,visible(-.01,0,.045,.075,story)*intro);
 opacity(parts.world,1-ease(.358,.382,story));parts.world.style.transform="none";
 if(story>.208&&story<.285&&!wasAttack){wasAttack=true;shockTime=now;hit(58,1.4,.15)}if(story<.195){wasAttack=false;shockTime=-1;voicePlayed=false}const shock=shockTime<0?0:(1-clamp((now-shockTime)/1700));parts.world.style.translate="0px 0px";
 opacity(parts.attack,visible(.226,.25,.297,.32,story));
 const black=Math.max(visible(.356,.38,.386,.403,story),visible(.513,.527,.531,.548,story),0);opacity(parts.black,black);
 opacity(parts.home,visible(.377,.399,.544,.565,story));parts.home.style.transform=`scale(${lerp(1,1.035,ease(.39,.51,story))})`;
 let line=Math.min(4,Math.max(0,Math.floor((story-.402)/.022)));const lineStart=.402+line*.022;opacity(parts.quote,visible(lineStart,lineStart+.004,lineStart+.017,lineStart+.022,story));parts.quote.querySelector('p').innerHTML=captions[line];parts.quote.querySelector('.eyebrow').textContent=line<3?'HIS UNCLE’S LAST WORDS':'AN UNANSWERED QUESTION';
 const paperOpen=ease(.53,.60,story),travel=clamp((story-.60)/.245);
 const leaving=departurePhase==='playing',pose=departurePose(departureT),memoryOpacity=leaving?(departureT<.17?1:0):departurePhase==='complete'&&p>=departureGate?0:visible(.525,.55,.87,.89,story);
 opacity(parts.memory,memoryOpacity);
 parts.memory.style.transform=leaving?`rotateX(${-5*ease(0,.16,departureT)}deg) scale(${lerp(1,.94,ease(0,.16,departureT))})`:`rotateY(${lerp(-9,0,paperOpen)}deg) scale(${lerp(.93,1,paperOpen)})`;
 parts.memory.style.setProperty('--fold',(leaving?pose.fold:lerp(47.8,0,paperOpen))+'%');
 const paper=$('.paper'),scrollWindow=$('.scroll-window');paper.style.setProperty('--paper-y',-travel*Math.max(0,paper.offsetHeight-scrollWindow.clientHeight)+'px');
 opacity(departure,leaving?1:0);departure.style.setProperty('--black',pose.black);departure.style.setProperty('--flight',leaving&&departureT>=.17?1-ease(.62,.82,departureT):0);departure.style.setProperty('--hole',pose.hole);departure.style.setProperty('--fall',pose.fall);departure.style.setProperty('--fallback-x',pose.x*38+'vw');departure.style.setProperty('--fallback-y',pose.y*43+'vh');departure.style.setProperty('--fallback-scale',pose.scale/pose.depth);departure.style.setProperty('--fallback-turn',pose.roll+'deg');
 if(leaving){departureRenderer?.update(departureT,now);if(departureImpact<DEPARTURE_IMPACTS.length&&departureT>=DEPARTURE_IMPACTS[departureImpact]){departureRenderer?.impact(now);hit(65+departureImpact*18,.23,.035);departureImpact++;departure.style.setProperty('--collision',1)}else departure.style.setProperty('--collision',Math.max(0,1-(departureT-(DEPARTURE_IMPACTS[departureImpact-1]??-1))/.035))}
 root.dataset.departurePhase=departurePhase;root.dataset.departureProgress=departureT.toFixed(4);
 document.body.classList.toggle('in-void',leaving&&pose.black>.25||fateOpacity>.015);
 const age=story<.665?'YEAR I':story<.75?'YEAR III':'YEAR VI';const act=story<.665?'Strength.':story<.75?'Shelter.':'Silence.';parts.years.querySelector('.eyebrow').textContent=age+' / A LIFE, RECORDED IN INK';parts.years.querySelector('p').textContent=act;opacity(parts.years,visible(.585,.61,.814,.842,story));
 opacity(parts.forest,ease(.86,.884,story));parts.forest.style.transform=`scale(${lerp(1.05,1.0,ease(.884,.93,story))}) translateY(${lerp(2,0,ease(.884,.93,story))}%)`;opacity(parts.find,visible(.885,.902,.932,.946,story));
 const open=ease(.948,.985,story);opacity(parts.artifact,ease(.927,.946,story));parts.artifact.style.transform=`translate3d(0,${lerp(25,10,ease(.928,.957,story))}vh,0) rotateX(${lerp(18,0,ease(.93,.975,story))}deg) scale(${lerp(.68,1,ease(.931,.979,story))})`;$('.revelation').style.setProperty('--closed',lerp(49,19,open)+'%');$('.hand.l').style.transform=`translateX(${lerp(-18,-50,open)}%)`;$('.hand.r').style.transform=`translateX(${lerp(-82,-50,open)}%)`;opacity(parts.end,visible(.981,.992,1,1.005,story));
 const dark=story>.21&&story<.553||story>.859||leaving&&pose.black>.25||fateOpacity>.5;$('.nav').classList.toggle('dark',dark);$('.hud').classList.toggle('dark',dark);const chapter=fateOpacity>.5?'05 / AN ENCOUNTER WRITTEN BY FATE':story<.21?'01 / AN ORDINARY LIFE':story<.38?'02 / WHAT REMAINS':story<.53?'03 / A FINAL WARNING':story<.86?'04 / THE YEARS BETWEEN':'05 / THE FOREST’S SECRET';$('#chapter').textContent=chapter;metrics.chapter=chapter;$('.meter').style.width=(p*100)+'%';
 dust.querySelectorAll('i').forEach((n,i)=>{n.style.opacity=String(visible(.24,.26,.357,.38,story)*(.3+(i%4)/7));n.style.transform=`translate3d(${Math.sin(now*.0006+i)*12}px,${-(now*.03+i*29)%170}px,0)`});
 if(sound&&context){wind.gain.setTargetAtTime(story>.38&&story<.55?.008:.035,context.currentTime,.4);if(story>.05&&story<.185&&Math.abs(target-p)>.0002&&now-footAt>360){hit(90,.12,.035);footAt=now}if(story>.229&&story<.25&&now-footAt>650){hit(180,.24,.015);footAt=now}if(story>.4&&story<.43&&!voicePlayed&&voice){voicePlayed=true;voice.play().catch(()=>{})}if(story<.38||story>.53)stopVoice()}
 if(!leaving)livingScenes?.update(story,now);
 metrics.ready=true;
}
$('#replay').addEventListener('click',()=>{cancelDeparture('armed');scrollTo(0,0);p=target=story=0;fatePrevious=0;fateShockAt=-1;start=performance.now();last=start;window.prologueProgress=0;wasAttack=false;shockTime=-1;stopVoice();voicePlayed=false});
addEventListener('pageshow',()=>{target=clamp(scrollY/Math.max(1,root.offsetHeight-innerHeight));p=target;story=storyProgress(p);window.prologueProgress=story;fatePrevious=clamp((p*(24/21)-fateStart)/fateLength);cancelDeparture(p>departureGate+.004?'complete':'armed');last=performance.now()});document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden){context?.suspend();voice?.pause();departure.hiddenAt=performance.now()}else{if(departurePhase==='playing'&&departure.hiddenAt)departureAt+=performance.now()-departure.hiddenAt;departure.hiddenAt=0;if(sound)context?.resume()}});
if(!reduced){requestAnimationFrame(render);import('./prologue-world.js').catch(error=>{document.body.classList.add('failed');root.dataset.ready='fallback';$('.loading').classList.add('loaded');console.error(error)})}else{root.dataset.ready='reduced';metrics.ready=true}

$("[data-close-link]").addEventListener("click",()=>{codexNavigation=true;codex.close()});
