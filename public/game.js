let THREE;
try {
  THREE = await import("./vendor/three.module.js");
} catch (localModuleError) {
  try {
    THREE = await import("https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js");
  } catch (cdnModuleError) {
    const title = document.getElementById("title"), start = document.getElementById("start");
    if (title) title.innerHTML = "LOAD<em>ERROR</em>";
    if (start) { start.textContent = "3D 파일을 다시 업로드해 주세요"; start.disabled = true; }
    throw new AggregateError([localModuleError, cdnModuleError], "Three.js를 불러오지 못했습니다.");
  }
}

const canvas = document.getElementById("game");
const ui = Object.fromEntries([
  "overlay","start","energy","distance","speed","boostState",
  "left","right","jump","soundToggle","title","tagline","eyebrow","finalScore","finalDistance"
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

// 미니카 높이에서 보이는 거대한 가구와 다층 배경 시차
const room = new THREE.Group(), scenery=[]; scene.add(room);
function addScenery(object){room.add(shadow(object));scenery.push(object);return object}
const wall=box(70,36,1,matte(0xb7b0a0,.95));wall.position.set(0,18,-128);room.add(wall);
const baseboard=box(70,2.2,1.5,matte(0xede0c9,.7));baseboard.position.set(0,1.1,-126.8);room.add(baseboard);
for(const side of[-1,1]){
  const cabinet=box(10,15,18,matte(side<0?0x344454:0x76533d,.72));cabinet.position.set(side*19,7.5,-62+(side+1)*-13);addScenery(cabinet);
  for(const z of[-20,-62,-104,-146]){const leg=cylinder(2.8,3.2,24,matte(0x4b2d1b,.6),16);leg.position.set(side*(17+Math.random()*3),12,z+(side>0?-18:0));addScenery(leg);}
}
const sofa=box(28,10,13,matte(0x35505d,.92));sofa.position.set(-22,5,-118);addScenery(sofa);
const shelf=box(20,26,5,matte(0x51321e,.76));shelf.position.set(23,13,-96);addScenery(shelf);

// 도로 밖 나무 바닥 이음선이 빠르게 흘러 주행감을 강화한다.
const floorDetails=[];
for(let z=-150;z<=24;z+=11)for(const x of[-12.2,12.2]){const seam=box(8.4,.022,.07,matte(0x4b2b18,.95));seam.position.set(x,.018,z);scene.add(seam);floorDetails.push(seam)}

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
  g.scale.setScalar(.58);g.position.set(0,0,3.2);return g;
}
const car=makeCar();scene.add(car);

function createObstacle(type){
  const g=new THREE.Group();let radius=2, jumpable=false, clearance=0, color=[0xff3150,0x3fc7ff,0xffcc31,0x7ddd58,0xaa71ff][Math.floor(Math.random()*5)];
  if(type==="block"){
    const m=matte(color,.4), accent=matte(new THREE.Color(color).multiplyScalar(.72),.48);
    const cube=box(4.4,4.2,4.4,m);cube.position.y=2.1;g.add(shadow(cube));
    const panel=box(3.25,2.8,.16,accent);panel.position.set(0,2.05,2.25);g.add(shadow(panel));
    for(const x of[-1.15,1.15])for(const z of[-1.15,1.15]){const stud=cylinder(.58,.58,.38,m,18);stud.position.set(x,4.38,z);g.add(shadow(stud));}
    for(const x of[-1.05,1.05])for(const y of[1.35,2.75]){const dot=cylinder(.34,.34,.2,m,16);dot.rotation.x=Math.PI/2;dot.position.set(x,y,2.42);g.add(shadow(dot));}radius=1.7;
  } else if(type==="ball"){
    const ball=new THREE.Mesh(new THREE.SphereGeometry(2.65,26,20),matte(color,.45));ball.position.y=2.65;g.add(shadow(ball));for(const rot of[0,Math.PI/2]){const stripe=new THREE.Mesh(new THREE.TorusGeometry(2.67,.13,10,34),matte(0xfff4d2,.4));stripe.position.y=2.65;stripe.rotation.set(Math.PI/2,rot,0);g.add(stripe);}radius=1.9;
  } else if(type==="cup"){
    const cupMat=matte(color,.28);
    const cup=cylinder(2.2,1.65,6.5,cupMat,28);cup.position.y=3.25;g.add(shadow(cup));
    const rim=new THREE.Mesh(new THREE.TorusGeometry(2.2,.14,10,32),matte(0xffffff,.2));rim.rotation.x=Math.PI/2;rim.position.y=6.5;g.add(rim);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(1.28,.3,14,32),cupMat);handle.position.set(2.55,3.65,0);g.add(shadow(handle));
    for(const y of[2.45,4.85]){const joint=cylinder(.34,.34,.9,cupMat,16);joint.rotation.z=Math.PI/2;joint.position.set(2.05,y,0);g.add(shadow(joint));}
    const band=new THREE.Mesh(new THREE.TorusGeometry(1.86,.08,8,32),matte(0xffffff,.35));band.rotation.x=Math.PI/2;band.position.y=4.3;g.add(band);radius=1.75;
  } else if(type==="book"){
    const angle=(Math.random()-.5)*.18, coverMat=matte(color,.42);const bottom=box(7.4,.22,5.2,coverMat);bottom.position.y=.3;bottom.rotation.y=angle;g.add(shadow(bottom));const pages=box(6.95,.62,4.75,matte(0xf3e4bd,.92));pages.position.y=.67;pages.rotation.y=angle;g.add(shadow(pages));const top=box(7.4,.22,5.2,coverMat);top.position.y=1.06;top.rotation.y=angle;g.add(shadow(top));const ribbon=box(.22,.08,4.9,matte(0xffd447,.4));ribbon.position.y=1.19;ribbon.rotation.y=angle;g.add(ribbon);radius=2.25;jumpable=true;clearance=.82;
  } else if(type==="pencil"){
    const yellow=matte(0xffc928,.5), wood=matte(0xeac28a,.78), graphite=matte(0x25282d,.45), pink=matte(0xff7895,.55);
    const shaft=cylinder(.38,.38,6.2,yellow,8);shaft.rotation.x=Math.PI/2;shaft.position.y=.42;g.add(shadow(shaft));
    const tip=cylinder(0,.4,1.15,wood,8);tip.rotation.x=Math.PI/2;tip.position.set(0,.42,-3.65);g.add(shadow(tip));
    const lead=cylinder(0,.17,.42,graphite,8);lead.rotation.x=Math.PI/2;lead.position.set(0,.42,-4.36);g.add(shadow(lead));
    const ferrule=cylinder(.41,.41,.5,matte(0xc8cbd0,.3,.65),12);ferrule.rotation.x=Math.PI/2;ferrule.position.set(0,.42,3.3);g.add(shadow(ferrule));
    const eraser=cylinder(.39,.39,.65,pink,12);eraser.rotation.x=Math.PI/2;eraser.position.set(0,.42,3.86);g.add(shadow(eraser));radius=.72;jumpable=true;clearance=.48;
  } else if(type==="duck"){
    const yellow=matte(0xffd21c,.46);const body=new THREE.Mesh(new THREE.SphereGeometry(2.4,24,18),yellow);body.scale.set(1.25,1,.9);body.position.y=2.4;g.add(shadow(body));const head=new THREE.Mesh(new THREE.SphereGeometry(1.65,24,18),yellow);head.position.set(1,5.1,0);g.add(shadow(head));const wing=new THREE.Mesh(new THREE.SphereGeometry(1.35,18,12),matte(0xffe55c,.5));wing.scale.set(1.3,.45,.9);wing.position.set(-.7,2.6,1.75);g.add(shadow(wing));const beak=box(1.7,.55,1.05,matte(0xff751f,.42));beak.position.set(2.15,4.9,0);g.add(shadow(beak));for(const z of[-.72,.72]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),matte(0x171717,.25));eye.position.set(1.95,5.45,z);g.add(eye);}radius=2.05;
  } else {
    const metal=matte(0x78d9e8,.32,.45), dark=matte(0x274353,.4,.4);const body=box(4.3,4.8,3.5,metal);body.position.y=4.1;g.add(shadow(body));const chest=box(2.8,2.1,.18,dark);chest.position.set(0,4.2,1.84);g.add(shadow(chest));for(const x of[-.75,0,.75]){const lamp=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),new THREE.MeshBasicMaterial({color:x?0xffd447:0xff3652}));lamp.position.set(x,4.2,1.97);g.add(lamp);}const head=box(3.8,3.1,3.2,metal);head.position.y=8.05;g.add(shadow(head));for(const x of[-.8,.8]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),new THREE.MeshBasicMaterial({color:0xff274c}));eye.position.set(x,8.3,1.64);g.add(eye);}const antenna=cylinder(.1,.1,1.5,dark,10);antenna.position.y=10.35;g.add(antenna);const tip=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),new THREE.MeshBasicMaterial({color:0xffd447}));tip.position.y=11.1;g.add(tip);for(const x of[-1.45,1.45]){const leg=box(.9,2.3,.9,metal);leg.position.set(x,1.2,0);g.add(shadow(leg));const arm=box(.65,3.7,.7,metal);arm.position.set(x*1.75,4.6,0);arm.rotation.z=x*.16;g.add(shadow(arm));}radius=1.95;
  }
  g.userData={type,radius,jumpable,clearance,hit:false,spin:type==="ball"?0:(Math.random()-.5)*.12};return g;
}

function createBoostPickup(){
  const g=new THREE.Group(), shape=new THREE.Shape();
  shape.moveTo(.18,1.55);shape.lineTo(-.72,.2);shape.lineTo(-.12,.2);shape.lineTo(-.48,-1.5);shape.lineTo(.78,.05);shape.lineTo(.18,.05);shape.closePath();
  const bolt=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:true,bevelSegments:2,bevelSize:.07,bevelThickness:.06}),new THREE.MeshStandardMaterial({color:0xffdf35,emissive:0xff8a00,emissiveIntensity:2.4,roughness:.25,metalness:.25}));bolt.position.z=-.12;g.add(shadow(bolt));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.55,.09,10,36),new THREE.MeshBasicMaterial({color:0x66eaff,transparent:true,opacity:.85}));g.add(ring);
  const glow=new THREE.PointLight(0xffc328,2.2,8);glow.position.z=1;g.add(glow);g.position.y=2.05;g.userData={phase:Math.random()*Math.PI*2,baseY:2.05};return g;
}

const obstacleKinds=["block","ball","cup","book","pencil","duck","robot"], obstacles=[], pickups=[];
const laneX=[-5.6,-2.8,0,2.8,5.6];
let safeLane=2,running=false,elapsed=0,distance=0,energy=100,speed=0,baseSpeed=560,spawnClock=0,boostTimer=0,jumpY=0,jumpV=0,lastPickupAt=-20,invincible=0,shake=0,last=performance.now();
const control={left:false,right:false}, carMotion={x:0,vx:0};

class AudioSystem{
  init(){
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
    if(this.ctx){this.ctx.resume?.();return true}
    try{this.ctx=new AC({latencyHint:"interactive"})}catch{this.ctx=new AC()}
    this.compressor=this.ctx.createDynamicsCompressor();this.compressor.threshold.value=-18;this.compressor.knee.value=16;this.compressor.ratio.value=5;this.compressor.attack.value=.003;this.compressor.release.value=.22;this.compressor.connect(this.ctx.destination);
    this.master=this.ctx.createGain();this.master.gain.value=.78;this.master.connect(this.compressor);
    this.music=this.ctx.createGain();this.music.gain.value=.3;this.music.connect(this.master);
    this.engineGain=this.ctx.createGain();this.engineGain.gain.value=.001;this.engineGain.connect(this.master);
    this.filter=this.ctx.createBiquadFilter();this.filter.type="lowpass";this.filter.Q.value=3.5;this.filter.connect(this.engineGain);
    this.engine=this.ctx.createOscillator();this.engine.type="sawtooth";this.engine.connect(this.filter);this.engine.start();
    this.engine2=this.ctx.createOscillator();this.engine2.type="square";this.engine2.detune.value=-1200;const sub=this.ctx.createGain();sub.gain.value=.18;this.engine2.connect(sub);sub.connect(this.filter);this.engine2.start();
    const silent=this.ctx.createBufferSource();silent.buffer=this.ctx.createBuffer(1,1,this.ctx.sampleRate);silent.connect(this.master);silent.start(0);
    this.next=this.ctx.currentTime;this.beat=0;this.ctx.resume?.();return true
  }
  tone(f,t,d,g,type="square",out=this.music){if(!this.ctx||!out)return;const o=this.ctx.createOscillator(),v=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);v.gain.setValueAtTime(Math.max(.001,g),t);v.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(v);v.connect(out);o.start(t);o.stop(t+d+.03)}
  noise(d=.2,g=.16,frequency=1400){if(!this.ctx)return;const size=Math.floor(this.ctx.sampleRate*d),b=this.ctx.createBuffer(1,size,this.ctx.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*(1-i/a.length);const s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),v=this.ctx.createGain();s.buffer=b;f.type="bandpass";f.frequency.value=frequency;f.Q.value=.7;v.gain.value=g;s.connect(f);f.connect(v);v.connect(this.master);s.start()}
  kick(t){if(!this.ctx)return;const o=this.ctx.createOscillator(),v=this.ctx.createGain();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(48,t+.12);v.gain.setValueAtTime(.25,t);v.gain.exponentialRampToValueAtTime(.001,t+.16);o.connect(v);v.connect(this.music);o.start(t);o.stop(t+.17)}
  startRace(){if(!this.init())return;this.ctx.resume?.();const t=this.ctx.currentTime+.02;[262,392,523,784].forEach((f,i)=>this.tone(f,t+i*.075,.3,.2,"sawtooth",this.music));this.next=t+.32;this.beat=0}
  enable(){if(!this.init())return;this.master.gain.setTargetAtTime(.78,this.ctx.currentTime,.03);this.ctx.resume?.();const t=this.ctx.currentTime+.01;this.tone(660,t,.1,.14,"sine",this.music);this.tone(990,t+.08,.16,.14,"sine",this.music)}
  jump(){if(!this.init())return;const t=this.ctx.currentTime;this.tone(240,t,.16,.18,"sine",this.engineGain);this.tone(480,t+.05,.2,.14,"sine",this.engineGain)}
  boost(){if(!this.init())return;this.ctx.resume?.();const t=this.ctx.currentTime;[180,270,405,610,820].forEach((f,i)=>this.tone(f,t+i*.045,.28,.18,"sawtooth",this.engineGain));this.noise(.55,.18,1900)}
  crash(){if(!this.init())return;this.ctx.resume?.();this.noise(.42,.42,650);const t=this.ctx.currentTime;this.tone(82,t,.48,.38,"sawtooth",this.engineGain);this.tone(47,t,.55,.28,"square",this.engineGain)}
  over(){if(!this.init())return;const t=this.ctx.currentTime;[392,294,220,147,82].forEach((f,i)=>this.tone(f,t+i*.16,.4,.18,"sawtooth"))}
  update(){if(!this.ctx)return;if(this.ctx.state==="suspended")return;const r=speed/900;this.engine.frequency.setTargetAtTime(72+r*210+(boostTimer>0?55:0),this.ctx.currentTime,.04);this.engine2.frequency.setTargetAtTime(72+r*210,this.ctx.currentTime,.05);this.filter.frequency.setTargetAtTime(420+r*1800,this.ctx.currentTime,.05);this.engineGain.gain.setTargetAtTime(running?.12+(boostTimer>0?.055:0):.001,this.ctx.currentTime,.08);while(running&&this.next<this.ctx.currentTime+.14){const step=this.beat%16,bar=Math.floor(this.beat/16),bass=[55,65.4,49,73.4][Math.floor(this.beat/4)%4];if(step%4===0)this.kick(this.next);this.tone(bass*(step%4===2?2:1),this.next,.13,step%4===0?.16:.07,"sawtooth");if(step%2===0)this.tone([440,523,659,784][(step/2+bar)%4],this.next,.07,.055,"square");if(step===4||step===12)this.tone(1800,this.next,.025,.035,"square");this.next+=boostTimer>0?.105:.135;this.beat++}}
}
const audio=new AudioSystem();

function spawn(){
  if(Math.random()<.58){const step=Math.random()<.5?-1:1;safeLane=THREE.MathUtils.clamp(safeLane+step,0,4)}
  const candidates=[0,1,2,3,4].filter(i=>Math.abs(i-safeLane)>1).sort(()=>Math.random()-.5);
  const count=elapsed>25&&candidates.length>1&&Math.random()<Math.min(.64,.28+elapsed*.004)?2:1;
  const chosen=[candidates[0]];if(count===2){const second=candidates.find(lane=>Math.abs(lane-chosen[0])>=3);if(second!==undefined)chosen.push(second)}
  for(const lane of chosen){const o=createObstacle(obstacleKinds[Math.floor(Math.random()*obstacleKinds.length)]);o.position.set(laneX[lane],0,-115);scene.add(o);obstacles.push(o);}
  if(elapsed-lastPickupAt>10&&boostTimer<=0&&pickups.length===0&&Math.random()<.28){const p=createBoostPickup();p.position.x=laneX[safeLane];p.position.z=-115;scene.add(p);pickups.push(p);lastPickupAt=elapsed}
}
function hit(o){if(o.userData.hit||invincible>0)return;if(o.userData.jumpable&&jumpY>o.userData.clearance)return;const dz=Math.abs(o.position.z-car.position.z);if(dz<1.85&&Math.abs(o.position.x-car.position.x)<o.userData.radius+.3){o.userData.hit=true;energy=Math.max(0,energy-10);invincible=1.25;shake=.55;ui.energy.style.width=energy+"%";audio.crash();navigator.vibrate?.([80,35,100]);o.rotation.z+=(car.position.x-o.position.x)*.25;if(energy<=0)endGame();}}
function updateWorld(dt){
  if(!running)return;elapsed+=dt;invincible=Math.max(0,invincible-dt);boostTimer=Math.max(0,boostTimer-dt);baseSpeed=Math.min(980,560+elapsed*5.4);speed=baseSpeed+(boostTimer>0?400:0);const units=speed*.06*dt;
  const dir=(control.left?-1:0)+(control.right?1:0);carMotion.vx+=dir*dt*34;carMotion.vx*=Math.pow(.025,dt);carMotion.x=THREE.MathUtils.clamp(carMotion.x+carMotion.vx*dt,-6.25,6.25);car.position.x+=(carMotion.x-car.position.x)*dt*15;car.rotation.z+=(dir*-.17-car.rotation.z)*dt*11;
  jumpV-=18*dt;jumpY+=jumpV*dt;if(jumpY<=0){jumpY=0;jumpV=0}car.position.y=jumpY;car.rotation.x+=( (jumpY>0?-jumpV*.018:0)-car.rotation.x)*dt*8;ui.jump.classList.toggle("airborne",jumpY>0);
  floorMat.map.offset.y-=units/11;for(const m of laneMarkers){m.position.z+=units;if(m.position.z>14)m.position.z-=130;}
  for(const detail of floorDetails){detail.position.z+=units;if(detail.position.z>25)detail.position.z-=176;}
  for(const prop of scenery){prop.position.z+=units*.62;if(prop.position.z>34)prop.position.z-=190;}
  spawnClock-=dt;if(spawnClock<=0){spawn();spawnClock=Math.max(.74,1.05-elapsed*.003)*(.95+Math.random()*.16);}
  for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];o.position.z+=units;o.rotation.y+=o.userData.spin*dt;hit(o);if(o.position.z>15){scene.remove(o);o.traverse(n=>{n.geometry?.dispose();if(n.material?.map)n.material.map.dispose();n.material?.dispose()});obstacles.splice(i,1);}}
  for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.position.z+=units;p.rotation.y+=dt*2.6;p.position.y=p.userData.baseY+Math.sin(elapsed*4+p.userData.phase)*.24;if(Math.abs(p.position.z-car.position.z)<2&&Math.abs(p.position.x-car.position.x)<1.05){boostTimer=5;audio.boost();navigator.vibrate?.([35,25,70]);scene.remove(p);pickups.splice(i,1);continue}if(p.position.z>15){scene.remove(p);pickups.splice(i,1)}}
  distance+=speed*dt/38;ui.distance.textContent=String(Math.floor(distance)).padStart(5,"0");ui.speed.textContent=String(Math.floor(speed)).padStart(3,"0");ui.boostState.classList.toggle("show",boostTimer>0);ui.boostState.textContent=boostTimer>0?`BOOST ${Math.ceil(boostTimer)}s`:"BOOST!";
  for(const f of car.userData.flames){f.material.opacity=boostTimer>0?.84:0;f.scale.y=.75+Math.random()*.55;}
  car.visible=!(invincible>0&&Math.floor(invincible*12)%2===0);camera.fov+=( (boostTimer>0?75:64)-camera.fov)*dt*5;camera.updateProjectionMatrix();audio.update();
}
function render(){
  const sx=shake>0?(Math.random()-.5)*shake:0,sy=shake>0?(Math.random()-.5)*shake*.35:0;shake*=.88;camera.position.x=car.position.x*.17+sx;camera.position.y=2.15+jumpY*.12+sy;camera.lookAt(car.position.x*.1,1.0+jumpY*.08,-19);sun.position.x=-18+car.position.x*.15;renderer.render(scene,camera);
}
function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;updateWorld(dt);render()}

function clearObstacles(){for(const list of[obstacles,pickups])while(list.length){const o=list.pop();scene.remove(o);o.traverse(n=>{n.geometry?.dispose();if(n.material?.map)n.material.map.dispose();n.material?.dispose()})}}
function startGame(){audio.startRace();running=true;elapsed=distance=0;energy=100;baseSpeed=speed=560;spawnClock=.85;boostTimer=jumpY=jumpV=0;lastPickupAt=-20;invincible=0;safeLane=2;carMotion.x=carMotion.vx=0;car.position.set(0,0,3.2);car.visible=true;clearObstacles();ui.energy.style.width="100%";ui.finalScore.classList.remove("show");ui.eyebrow.textContent="";ui.title.innerHTML="MINI<em>Racer</em>";ui.tagline.textContent="";ui.start.textContent="ENGINE START";ui.overlay.classList.add("hidden")}
function endGame(){if(!running)return;running=false;speed=0;audio.over();navigator.vibrate?.([100,50,100,50,180]);ui.finalDistance.textContent=Math.floor(distance)+" m";ui.finalScore.classList.add("show");ui.eyebrow.textContent="ENGINE OVERHEATED";ui.title.innerHTML="RACE<em>OVER</em>";ui.tagline.textContent=distance>1500?"거대한 세상을 아주 멀리 달렸어요!":"다시 도전할까요?";ui.start.textContent="RESTART RACE";setTimeout(()=>ui.overlay.classList.remove("hidden"),550)}
function jumpCar(){if(!running||jumpY>0)return;jumpV=7.8;audio.jump();navigator.vibrate?.(25)}
function bindHold(el,key){const on=e=>{e.preventDefault();control[key]=true;el.classList.add("active");audio.init()},off=e=>{e.preventDefault();control[key]=false;el.classList.remove("active")};el.addEventListener("pointerdown",on);el.addEventListener("pointerup",off);el.addEventListener("pointercancel",off);el.addEventListener("pointerleave",off)}
bindHold(ui.left,"left");bindHold(ui.right,"right");ui.jump.addEventListener("pointerdown",e=>{e.preventDefault();jumpCar()});ui.start.addEventListener("click",startGame);
ui.soundToggle.addEventListener("pointerdown",e=>{e.preventDefault();audio.enable();ui.soundToggle.textContent="🔊 SOUND ON"});
addEventListener("keydown",e=>{if(["ArrowLeft","a","A"].includes(e.key))control.left=true;if(["ArrowRight","d","D"].includes(e.key))control.right=true;if(e.code==="Space"){e.preventDefault();jumpCar()}});addEventListener("keyup",e=>{if(["ArrowLeft","a","A"].includes(e.key))control.left=false;if(["ArrowRight","d","D"].includes(e.key))control.right=false});
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight,false)});
document.addEventListener("visibilitychange",()=>{if(document.hidden){control.left=control.right=false;last=performance.now()}});
renderer.setAnimationLoop(loop);
