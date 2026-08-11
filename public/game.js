import * as THREE from "./vendor/three.module.js";

const canvas = document.getElementById("game");
const ui = Object.fromEntries([
  "overlay","start","energy","distance","speed","boost","boostText","boostState",
  "left","right","title","tagline","eyebrow","finalScore","finalDistance","tips"
].map(id => [id, document.getElementById(id)]));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6f7f8b);
scene.fog = new THREE.FogExp2(0x87939a, 0.013);

const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.08, 260);
camera.position.set(0, 2.15, 8.2);
camera.lookAt(0, 1.05, -20);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

scene.add(new THREE.HemisphereLight(0xd9efff, 0x56351e, 2.2));
const sun = new THREE.DirectionalLight(0xffe2b8, 3.8);
sun.position.set(-18, 30, 12); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -15; scene.add(sun);

const matte = (color, roughness=.7, metalness=0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const box = (w,h,d,material) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
const cylinder = (r1,r2,h,material,segments=20) => new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);
function shadow(mesh, cast=true, receive=true) { mesh.castShadow=cast; mesh.receiveShadow=receive; return mesh; }

function woodTexture() {
  const c=document.createElement("canvas"); c.width=512; c.height=512; const x=c.getContext("2d");
  x.fillStyle="#9b6840"; x.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=64){x.fillStyle=y%128===0?"#a87549":"#8e5d39";x.fillRect(0,y,512,62);x.fillStyle="#57361f";x.fillRect(0,y+61,512,3);}
  for(let i=0;i<90;i++){x.strokeStyle=`rgba(55,28,12,${.03+Math.random()*.08})`;x.lineWidth=1+Math.random()*2;x.beginPath();const y=Math.random()*512;x.moveTo(0,y);x.bezierCurveTo(160,y+Math.random()*16-8,360,y+Math.random()*16-8,512,y);x.stroke();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,24);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

const floorMat = new THREE.MeshStandardMaterial({ map:woodTexture(), roughness:.66, metalness:.02 });
const floor = shadow(new THREE.Mesh(new THREE.PlaneGeometry(38,260), floorMat),false,true);
floor.rotation.x=-Math.PI/2; floor.position.set(0,-.03,-112); scene.add(floor);
const runner = shadow(new THREE.Mesh(new THREE.PlaneGeometry(15.5,250),matte(0x33424b,.92)),false,true);
runner.rotation.x=-Math.PI/2;runner.position.set(0,.012,-108);scene.add(runner);

// 미니카 높이의 카메라에서 거대하게 보이는 가구와 방 구조
const room = new THREE.Group(); scene.add(room);
const wall=box(70,36,1,matte(0xb7b0a0,.95));wall.position.set(0,18,-128);room.add(wall);
const baseboard=box(70,2.2,1.5,matte(0xede0c9,.7));baseboard.position.set(0,1.1,-126.8);room.add(baseboard);
for(const side of[-1,1]){
  const cabinet=box(10,15,18,matte(side<0?0x344454:0x76533d,.72));cabinet.position.set(side*19,7.5,-70);room.add(shadow(cabinet));
  for(const z of[-34,-4,30]){const leg=cylinder(2.8,3.2,24,matte(0x4b2d1b,.6),16);leg.position.set(side*(16+Math.random()*4),12,z);room.add(shadow(leg));}
}
const sofa=box(28,10,13,matte(0x35505d,.92));sofa.position.set(-22,5,-110);room.add(shadow(sofa));
const shelf=box(20,26,5,matte(0x51321e,.76));shelf.position.set(23,13,-110);room.add(shadow(shelf));

// 속도감을 주는 바닥 점선
const laneMarkers=[];
for(let i=0;i<26;i++) for(const x of[-3.8,3.8]) { const m=box(.16,.035,3.2,matte(0xffd33d,.55,.05));m.position.set(x,.04,-i*10+8);m.receiveShadow=true;scene.add(m);laneMarkers.push(m); }

function makeCar(){
  const g=new THREE.Group();
  const red=matte(0xea0b2f,.28,.45), dark=matte(0x090b0f,.28,.65), glass=new THREE.MeshPhysicalMaterial({color:0x1d526c,roughness:.15,metalness:.35,transmission:.12});
  const lower=box(1.28,.33,2.35,red);lower.position.y=.38;g.add(shadow(lower));
  const hood=box(1.15,.25,.82,red);hood.position.set(0,.64,-.69);hood.rotation.x=-.08;g.add(shadow(hood));
  const cabin=box(.9,.45,.92,glass);cabin.position.set(0,.79,.18);cabin.rotation.x=-.08;g.add(shadow(cabin));
  const spoiler=box(1.3,.08,.28,dark);spoiler.position.set(0,.82,1.05);g.add(shadow(spoiler));
  for(const x of[-.67,.67])for(const z of[-.68,.72]){const w=cylinder(.25,.25,.16,dark,16);w.rotation.z=Math.PI/2;w.position.set(x,.28,z);g.add(shadow(w));}
  const light=matte(0xffffd3,.2,.2);for(const x of[-.4,.4]){const l=box(.24,.12,.05,light);l.position.set(x,.52,-1.19);g.add(l);}
  const plate=box(.5,.13,.03,matte(0xf5f5f2));plate.position.set(0,.34,1.19);g.add(plate);
  const boostMat=new THREE.MeshBasicMaterial({color:0x50dfff,transparent:true,opacity:0});
  g.userData.flames=[];for(const x of[-.32,.32]){const flame=new THREE.Mesh(new THREE.ConeGeometry(.13,1.6,10),boostMat.clone());flame.rotation.x=Math.PI/2;flame.position.set(x,.32,1.85);g.add(flame);g.userData.flames.push(flame);}
  g.scale.setScalar(.82);g.position.set(0,0,3.2);return g;
}
const car=makeCar();scene.add(car);

function labelTexture(letter,color="#fff"){
  const c=document.createElement("canvas");c.width=c.height=256;const x=c.getContext("2d");x.fillStyle=color;x.font="900 160px Arial";x.textAlign="center";x.textBaseline="middle";x.fillText(letter,128,138);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function createObstacle(type){
  const g=new THREE.Group();let radius=2, color=[0xff3150,0x3fc7ff,0xffcc31,0x7ddd58,0xaa71ff][Math.floor(Math.random()*5)];
  if(type==="block"){
    const m=matte(color,.48);const cube=box(4.5,4.5,4.5,m);cube.position.y=2.25;g.add(shadow(cube));
    const face=new THREE.Mesh(new THREE.PlaneGeometry(2.7,2.7),new THREE.MeshBasicMaterial({map:labelTexture(String.fromCharCode(65+Math.floor(Math.random()*6))),transparent:true}));face.position.set(0,2.25,2.256);g.add(face);radius=2.35;
  } else if(type==="ball"){
    const ball=new THREE.Mesh(new THREE.SphereGeometry(2.65,22,16),matte(color,.55));ball.position.y=2.65;g.add(shadow(ball));const stripe=new THREE.Mesh(new THREE.TorusGeometry(2.67,.14,10,28),matte(0xf9f4dd,.5));stripe.position.y=2.65;stripe.rotation.y=Math.PI/2;g.add(stripe);radius=2.55;
  } else if(type==="cup"){
    const cup=cylinder(2.2,1.65,6.5,matte(color,.35),24);cup.position.y=3.25;g.add(shadow(cup));const rim=new THREE.Mesh(new THREE.TorusGeometry(2.2,.14,10,28),matte(0xffffff,.25));rim.rotation.x=Math.PI/2;rim.position.y=6.5;g.add(rim);const handle=new THREE.Mesh(new THREE.TorusGeometry(1.5,.28,12,24,Math.PI*1.55),matte(color,.35));handle.position.set(2.1,3.7,0);handle.rotation.y=Math.PI/2;g.add(shadow(handle));radius=2.5;
  } else if(type==="book"){
    const cover=box(7.4,.75,5.2,matte(color,.5));cover.position.y=.55;cover.rotation.y=(Math.random()-.5)*.5;g.add(shadow(cover));const pages=box(6.9,.58,4.8,matte(0xf3e4bd,.95));pages.position.y=.92;pages.rotation.y=cover.rotation.y;g.add(shadow(pages));radius=3.4;
  } else if(type==="duck"){
    const yellow=matte(0xffd21c,.54);const body=new THREE.Mesh(new THREE.SphereGeometry(2.4,20,14),yellow);body.scale.set(1.25,1,.9);body.position.y=2.4;g.add(shadow(body));const head=new THREE.Mesh(new THREE.SphereGeometry(1.65,20,14),yellow);head.position.set(1,5.1,0);g.add(shadow(head));const beak=box(1.7,.55,1.05,matte(0xff751f,.5));beak.position.set(2.15,4.9,0);g.add(shadow(beak));radius=2.9;
  } else {
    const metal=matte(0x78d9e8,.38,.38);const body=box(4.3,4.8,3.5,metal);body.position.y=4.1;g.add(shadow(body));const head=box(3.8,3.1,3.2,metal);head.position.y=8.05;g.add(shadow(head));for(const x of[-.8,.8]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),new THREE.MeshBasicMaterial({color:0xff274c}));eye.position.set(x,8.3,1.64);g.add(eye);}for(const x of[-1.45,1.45]){const leg=box(.9,2.3,.9,metal);leg.position.set(x,1.2,0);g.add(shadow(leg));}radius=2.6;
  }
  g.userData={type,radius,hit:false,spin:(Math.random()-.5)*.35};return g;
}

const obstacleKinds=["block","ball","cup","book","duck","robot"], obstacles=[];
let running=false,elapsed=0,distance=0,energy=100,speed=0,baseSpeed=245,spawnClock=0,boostTimer=0,boostCooldown=0,invincible=0,shake=0,last=performance.now();
const control={left:false,right:false}, carMotion={x:0,vx:0};

class AudioSystem{
  init(){if(this.ctx){this.ctx.resume();return}const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.38;this.master.connect(this.ctx.destination);this.music=this.ctx.createGain();this.music.gain.value=.18;this.music.connect(this.master);this.engineGain=this.ctx.createGain();this.engineGain.gain.value=.02;this.engineGain.connect(this.master);this.filter=this.ctx.createBiquadFilter();this.filter.type="lowpass";this.engine=this.ctx.createOscillator();this.engine.type="sawtooth";this.engine.connect(this.filter);this.filter.connect(this.engineGain);this.engine.start();this.next=this.ctx.currentTime;this.beat=0}
  tone(f,t,d,g,type="square",out=this.music){if(!this.ctx)return;const o=this.ctx.createOscillator(),v=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);v.gain.setValueAtTime(g,t);v.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(v);v.connect(out);o.start(t);o.stop(t+d+.02)}
  noise(d=.2,g=.16){if(!this.ctx)return;const b=this.ctx.createBuffer(1,this.ctx.sampleRate*d,this.ctx.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*(1-i/a.length);const s=this.ctx.createBufferSource(),v=this.ctx.createGain();s.buffer=b;v.gain.value=g;s.connect(v);v.connect(this.master);s.start()}
  boost(){if(!this.ctx)return;const t=this.ctx.currentTime;[180,260,390,580].forEach((f,i)=>this.tone(f,t+i*.06,.24,.11,"sawtooth",this.engineGain));this.noise(.5,.08)}
  crash(){if(!this.ctx)return;this.noise(.35,.3);const t=this.ctx.currentTime;this.tone(75,t,.4,.3,"sawtooth",this.engineGain)}
  over(){if(!this.ctx)return;const t=this.ctx.currentTime;[330,247,185,92].forEach((f,i)=>this.tone(f,t+i*.17,.35,.13,"sawtooth"))}
  update(){if(!this.ctx)return;const r=speed/650;this.engine.frequency.setTargetAtTime(58+r*160+(boostTimer>0?42:0),this.ctx.currentTime,.05);this.filter.frequency.setTargetAtTime(260+r*1200,this.ctx.currentTime,.06);this.engineGain.gain.setTargetAtTime(running?.055+(boostTimer>0?.035:0):.012,this.ctx.currentTime,.1);while(running&&this.next<this.ctx.currentTime+.12){const step=this.beat%16,bass=[55,65.4,49,73.4][Math.floor(this.beat/4)%4];this.tone(bass*(step%4===2?2:1),this.next,.11,step%4===0?.11:.045,"sawtooth");if(step%2===0)this.tone(step%4?740:980,this.next,.035,.025);this.next+=boostTimer>0?.125:Math.max(.15,.22-elapsed*.0005);this.beat++}}
}
const audio=new AudioSystem();

function spawn(){
  const count=elapsed>45&&Math.random()<Math.min(.55,(elapsed-45)/100)?2:1;
  const lanes=count===2?[-4.8+Math.random()*1.5,3.3+Math.random()*1.5]:[-6+Math.random()*12];
  for(const x of lanes){const o=createObstacle(obstacleKinds[Math.floor(Math.random()*obstacleKinds.length)]);o.position.set(x,0,-90-Math.random()*12);scene.add(o);obstacles.push(o);}
}
function hit(o){if(o.userData.hit||invincible>0)return;const dz=Math.abs(o.position.z-car.position.z);if(dz<2.1&&Math.abs(o.position.x-car.position.x)<o.userData.radius+.52){o.userData.hit=true;energy=Math.max(0,energy-10);invincible=1.25;shake=.55;ui.energy.style.width=energy+"%";audio.crash();navigator.vibrate?.([80,35,100]);o.rotation.z+=(car.position.x-o.position.x)*.25;if(energy<=0)endGame();}}
function updateWorld(dt){
  if(!running)return;elapsed+=dt;invincible=Math.max(0,invincible-dt);boostTimer=Math.max(0,boostTimer-dt);boostCooldown=Math.max(0,boostCooldown-dt);baseSpeed=Math.min(560,245+elapsed*3.1);speed=baseSpeed+(boostTimer>0?230:0);const units=speed*.043*dt;
  const dir=(control.left?-1:0)+(control.right?1:0);carMotion.vx+=dir*dt*20;carMotion.vx*=Math.pow(.018,dt);carMotion.x=THREE.MathUtils.clamp(carMotion.x+carMotion.vx*dt,-6.25,6.25);car.position.x+=(carMotion.x-car.position.x)*dt*12;car.rotation.z+=(dir*-.14-car.rotation.z)*dt*9;
  floorMat.map.offset.y-=units/11;for(const m of laneMarkers){m.position.z+=units;if(m.position.z>14)m.position.z-=130;}
  spawnClock-=dt;if(spawnClock<=0){spawn();spawnClock=Math.max(.44,1.28-elapsed*.009)*(.8+Math.random()*.45);}
  for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];o.position.z+=units;o.rotation.y+=o.userData.spin*dt;if(o.userData.type==="ball")o.rotation.x+=units*.22;hit(o);if(o.position.z>15){scene.remove(o);o.traverse(n=>{n.geometry?.dispose();if(n.material?.map)n.material.map.dispose();n.material?.dispose()});obstacles.splice(i,1);}}
  distance+=speed*dt/38;ui.distance.textContent=String(Math.floor(distance)).padStart(5,"0");ui.speed.textContent=String(Math.floor(speed)).padStart(3,"0");ui.boostState.classList.toggle("show",boostTimer>0);ui.boost.classList.toggle("cooling",boostCooldown>0);ui.boostText.textContent=boostTimer>0?Math.ceil(boostTimer)+" SEC":boostCooldown>0?Math.ceil(boostCooldown)+" SEC":"READY";
  for(const f of car.userData.flames){f.material.opacity=boostTimer>0?.84:0;f.scale.y=.75+Math.random()*.55;}
  car.visible=!(invincible>0&&Math.floor(invincible*12)%2===0);camera.fov+=( (boostTimer>0?75:64)-camera.fov)*dt*5;camera.updateProjectionMatrix();audio.update();
}
function render(){
  const sx=shake>0?(Math.random()-.5)*shake:0,sy=shake>0?(Math.random()-.5)*shake*.35:0;shake*=.88;camera.position.x=car.position.x*.17+sx;camera.position.y=2.15+sy;camera.lookAt(car.position.x*.1,1.0,-19);sun.position.x=-18+car.position.x*.15;renderer.render(scene,camera);
}
function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;updateWorld(dt);render()}

function clearObstacles(){while(obstacles.length){const o=obstacles.pop();scene.remove(o);o.traverse(n=>{n.geometry?.dispose();if(n.material?.map)n.material.map.dispose();n.material?.dispose()})}}
function startGame(){audio.init();running=true;elapsed=distance=0;energy=100;baseSpeed=speed=245;spawnClock=.65;boostTimer=boostCooldown=invincible=0;carMotion.x=carMotion.vx=0;car.position.x=0;car.visible=true;clearObstacles();ui.energy.style.width="100%";ui.finalScore.classList.remove("show");ui.tips.style.display="grid";ui.eyebrow.textContent="";ui.title.innerHTML="MINI<em>Racer</em>";ui.tagline.innerHTML="거대한 집 안을 질주하라! 장난감을 피하고<br>부스터로 최고 기록을 깨뜨리세요.";ui.start.textContent="ENGINE START";ui.overlay.classList.add("hidden")}
function endGame(){if(!running)return;running=false;speed=0;audio.over();navigator.vibrate?.([100,50,100,50,180]);ui.finalDistance.textContent=Math.floor(distance)+" m";ui.finalScore.classList.add("show");ui.tips.style.display="none";ui.eyebrow.textContent="ENGINE OVERHEATED";ui.title.innerHTML="RACE<em>OVER</em>";ui.tagline.textContent=distance>1500?"거대한 세상을 아주 멀리 달렸어요!":"장난감은 미니카보다 훨씬 커요. 다시 도전할까요?";ui.start.textContent="RESTART RACE";setTimeout(()=>ui.overlay.classList.remove("hidden"),550)}
function useBoost(){if(!running||boostCooldown>0||boostTimer>0)return;boostTimer=5;boostCooldown=11;audio.boost();navigator.vibrate?.(45)}
function bindHold(el,key){const on=e=>{e.preventDefault();control[key]=true;el.classList.add("active");audio.init()},off=e=>{e.preventDefault();control[key]=false;el.classList.remove("active")};el.addEventListener("pointerdown",on);el.addEventListener("pointerup",off);el.addEventListener("pointercancel",off);el.addEventListener("pointerleave",off)}
bindHold(ui.left,"left");bindHold(ui.right,"right");ui.boost.addEventListener("pointerdown",e=>{e.preventDefault();useBoost()});ui.start.addEventListener("click",startGame);
addEventListener("keydown",e=>{if(["ArrowLeft","a","A"].includes(e.key))control.left=true;if(["ArrowRight","d","D"].includes(e.key))control.right=true;if(e.code==="Space"){e.preventDefault();useBoost()}});addEventListener("keyup",e=>{if(["ArrowLeft","a","A"].includes(e.key))control.left=false;if(["ArrowRight","d","D"].includes(e.key))control.right=false});
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight,false)});
document.addEventListener("visibilitychange",()=>{if(document.hidden){control.left=control.right=false;last=performance.now()}});
renderer.setAnimationLoop(loop);
