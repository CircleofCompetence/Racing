import { choosePickupKind, fallingFruitSpawnY, flightMotionStep, fruitHitsCar, groundObstacleCanDamage, impactDirections } from "./game-physics.js";

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
  "left","right","jump","soundToggle","viewToggle","title","tagline","eyebrow","finalScore","finalDistance"
].map(id => [id, document.getElementById(id)]));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6f7f8b);
scene.fog = new THREE.FogExp2(0x87939a, 0.013);

const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.08, 260);
camera.position.set(0, 2.15, 8.2);
camera.lookAt(0, 1.05, -20);
scene.add(camera);

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
sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80; sun.shadow.camera.far = 280; sun.shadow.bias = -.0003; scene.add(sun);

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
  const wingMat=matte(0x30bce8,.2,.55);g.userData.jetParts=[];
  for(const x of[-1,1]){const wing=box(.82,.07,.72,wingMat);wing.position.set(x*.86,.43,.18);wing.rotation.y=x*.18;wing.visible=false;g.add(shadow(wing));g.userData.jetParts.push(wing)}
  const tailFin=box(.1,.52,.52,wingMat);tailFin.position.set(0,.78,.84);tailFin.rotation.x=-.25;tailFin.visible=false;g.add(shadow(tailFin));g.userData.jetParts.push(tailFin);
  g.scale.setScalar(.46);g.position.set(0,0,3.2);return g;
}
const car=makeCar();scene.add(car);

function makeCockpit(){
  const g=new THREE.Group(), black=new THREE.MeshBasicMaterial({color:0x111820}), red=new THREE.MeshBasicMaterial({color:0x9f071e}), metal=new THREE.MeshBasicMaterial({color:0x53616b}), glass=new THREE.MeshBasicMaterial({color:0x8ce2ff,transparent:true,opacity:.16,depthWrite:false});
  const dash=box(1.82,.2,.45,black);dash.position.set(0,-.54,-1.16);g.add(dash);
  const hood=box(1.72,.09,1.75,red);hood.position.set(0,-.64,-2.02);hood.rotation.x=-.035;g.add(hood);
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(.18,.035,10,24),metal);wheel.position.set(-.25,-.4,-.92);g.add(wheel);
  for(const angle of[0,Math.PI/2]){const spoke=box(.27,.02,.02,metal);spoke.position.copy(wheel.position);spoke.rotation.z=angle;g.add(spoke)}
  for(const x of[-.9,.9]){const pillar=box(.065,1.16,.06,black);pillar.position.set(x,.02,-1.42);pillar.rotation.z=x*.07;g.add(pillar)}
  const topBar=box(1.88,.065,.06,black);topBar.position.set(0,.6,-1.43);g.add(topBar);
  const windshield=box(1.68,.86,.012,glass);windshield.position.set(0,.07,-1.47);g.add(windshield);
  const mirror=box(.32,.1,.06,black);mirror.position.set(0,.43,-1.08);g.add(mirror);
  g.visible=false;return g;
}
const cockpit=makeCockpit();camera.add(cockpit);

function createObstacle(type){
  const g=new THREE.Group();let radius=2, jumpable=false, clearance=0, color=[0xff3150,0x3fc7ff,0xffcc31,0x7ddd58,0xaa71ff][Math.floor(Math.random()*5)];
  if(type==="block"){
    const variants=[
      {w:4.4,h:4.1,d:4.2,cols:2,rows:2},
      {w:6.1,h:2.5,d:3.8,cols:4,rows:2},
      {w:3.5,h:5.4,d:3.5,cols:2,rows:2},
      {w:6.7,h:1.9,d:2.7,cols:5,rows:1},
      {w:5.2,h:3.1,d:3.4,cols:3,rows:2},
      {w:2.8,h:6.2,d:2.8,cols:1,rows:2}
    ], spec=variants[Math.floor(Math.random()*variants.length)], m=matte(color,.38), accentColor=new THREE.Color(color).multiplyScalar(.68), accent=matte(accentColor,.48);
    const brick=box(spec.w,spec.h,spec.d,m);brick.position.y=spec.h/2;g.add(shadow(brick));
    const inset=box(spec.w*.72,spec.h*.48,.15,accent);inset.position.set(0,spec.h*.52,spec.d/2+.08);g.add(shadow(inset));
    for(let ix=0;ix<spec.cols;ix++)for(let iz=0;iz<spec.rows;iz++){const x=(ix-(spec.cols-1)/2)*(spec.w/spec.cols),z=(iz-(spec.rows-1)/2)*(spec.d/spec.rows),stud=cylinder(.43,.43,.34,m,18);stud.position.set(x,spec.h+.17,z);g.add(shadow(stud));}
    if(spec.h>5){const belt=box(spec.w+.08,.34,spec.d+.08,matte(0xffd447,.42));belt.position.y=spec.h*.58;g.add(shadow(belt));}
    if(spec.h<2.1){for(const x of[-spec.w*.28,spec.w*.28]){const lower=box(spec.w*.35,.65,spec.d*.82,accent);lower.position.set(x,.32,0);g.add(shadow(lower));}}
    radius=Math.min(2.35,spec.w*.34);
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
    const angle=(Math.random()-.5)*.18, coverMat=matte(color,.42);const bottom=box(7.4,.22,5.2,coverMat);bottom.position.y=.3;bottom.rotation.y=angle;g.add(shadow(bottom));const pages=box(6.95,.62,4.75,matte(0xf3e4bd,.92));pages.position.y=.67;pages.rotation.y=angle;g.add(shadow(pages));const top=box(7.4,.22,5.2,coverMat);top.position.y=1.06;top.rotation.y=angle;g.add(shadow(top));const ribbon=box(.22,.08,4.9,matte(0xffd447,.4));ribbon.position.y=1.19;ribbon.rotation.y=angle;g.add(ribbon);radius=2.25;jumpable=true;clearance=.62;
  } else if(type==="pencil"){
    const yellow=matte(0xffc928,.5), wood=matte(0xeac28a,.78), graphite=matte(0x25282d,.45), pink=matte(0xff7895,.55);
    const shaft=cylinder(.4,.4,6.2,yellow,6);shaft.rotation.z=Math.PI/2;shaft.position.y=.43;g.add(shadow(shaft));
    const highlight=box(5.8,.07,.09,matte(0xffeb68,.4));highlight.position.set(0,.76,.16);g.add(shadow(highlight));
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.42,1.28,12),wood);tip.rotation.z=Math.PI/2;tip.position.set(-3.72,.43,0);g.add(shadow(tip));
    const lead=new THREE.Mesh(new THREE.ConeGeometry(.16,.52,10),graphite);lead.rotation.z=Math.PI/2;lead.position.set(-4.58,.43,0);g.add(shadow(lead));
    const ferruleMat=matte(0xc8cbd0,.25,.72);const ferrule=cylinder(.43,.43,.58,ferruleMat,16);ferrule.rotation.z=Math.PI/2;ferrule.position.set(3.38,.43,0);g.add(shadow(ferrule));
    for(const x of[3.17,3.38,3.59]){const groove=new THREE.Mesh(new THREE.TorusGeometry(.435,.025,6,18),matte(0x7f8992,.3,.8));groove.rotation.y=Math.PI/2;groove.position.set(x,.43,0);g.add(groove)}
    const eraser=cylinder(.4,.4,.72,pink,16);eraser.rotation.z=Math.PI/2;eraser.position.set(4.02,.43,0);g.add(shadow(eraser));const cap=new THREE.Mesh(new THREE.SphereGeometry(.4,16,10),pink);cap.scale.x=.5;cap.position.set(4.39,.43,0);g.add(shadow(cap));radius=3.1;jumpable=true;clearance=.35;
  } else if(type==="duck"){
    const yellow=matte(0xffd21c,.42), wingMat=matte(0xffe76a,.5);const body=new THREE.Mesh(new THREE.SphereGeometry(2.4,24,18),yellow);body.scale.set(1.22,1,.92);body.position.y=2.4;g.add(shadow(body));const head=new THREE.Mesh(new THREE.SphereGeometry(1.65,24,18),yellow);head.position.set(0,5.05,.25);g.add(shadow(head));for(const x of[-2.25,2.25]){const wing=new THREE.Mesh(new THREE.SphereGeometry(1.28,18,12),wingMat);wing.scale.set(.48,1.05,.86);wing.rotation.z=x*.12;wing.position.set(x,2.75,.25);g.add(shadow(wing));}const beak=box(1.5,.52,1.12,matte(0xff751f,.4));beak.position.set(0,4.78,1.72);g.add(shadow(beak));for(const x of[-.6,.6]){const white=new THREE.Mesh(new THREE.SphereGeometry(.36,16,12),matte(0xffffff,.18));white.position.set(x,5.5,1.78);g.add(shadow(white));const pupil=new THREE.Mesh(new THREE.SphereGeometry(.21,14,10),matte(0x101317,.12));pupil.position.set(x,5.48,2.06);g.add(pupil);const iris=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),new THREE.MeshBasicMaterial({color:0x2c7fc1}));iris.position.set(x,5.48,2.22);g.add(iris);const glint=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),new THREE.MeshBasicMaterial({color:0xffffff}));glint.position.set(x-.06,5.57,2.3);g.add(glint);}radius=2.05;
  } else if(type==="robot"){
    const metal=matte(0x78d9e8,.32,.45), dark=matte(0x274353,.4,.4);const body=box(4.3,4.8,3.5,metal);body.position.y=4.1;g.add(shadow(body));const chest=box(2.8,2.1,.18,dark);chest.position.set(0,4.2,1.84);g.add(shadow(chest));for(const x of[-.75,0,.75]){const lamp=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),new THREE.MeshBasicMaterial({color:x?0xffd447:0xff3652}));lamp.position.set(x,4.2,1.97);g.add(lamp);}const head=box(3.8,3.1,3.2,metal);head.position.y=8.05;g.add(shadow(head));for(const x of[-.8,.8]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),new THREE.MeshBasicMaterial({color:0xff274c}));eye.position.set(x,8.3,1.64);g.add(eye);}const antenna=cylinder(.1,.1,1.5,dark,10);antenna.position.y=10.35;g.add(antenna);const tip=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),new THREE.MeshBasicMaterial({color:0xffd447}));tip.position.y=11.1;g.add(tip);for(const x of[-1.45,1.45]){const leg=box(.9,2.3,.9,metal);leg.position.set(x,1.2,0);g.add(shadow(leg));const arm=box(.65,3.7,.7,metal);arm.position.set(x*1.75,4.6,0);arm.rotation.z=x*.16;g.add(shadow(arm));}radius=1.95;
  } else if(type==="train"){
    const red=matte(0xe62945,.38), blue=matte(0x2d8de0,.4), gold=matte(0xffd447,.3,.3), dark=matte(0x202936,.45,.45);const base=box(5.8,.65,4.3,red);base.position.y=.7;g.add(shadow(base));const boiler=cylinder(1.35,1.35,3.4,blue,22);boiler.rotation.x=Math.PI/2;boiler.position.set(0,2.25,.2);g.add(shadow(boiler));const cab=box(3.2,3.3,1.8,red);cab.position.set(0,2.45,-1.65);g.add(shadow(cab));const windowMat=matte(0x183849,.2,.5);for(const x of[-.75,.75]){const window=box(.82,.82,.08,windowMat);window.position.set(x,2.9,-.72);g.add(window)}const chimney=cylinder(.58,.82,2.15,dark,18);chimney.position.set(0,4.2,1.05);g.add(shadow(chimney));const lamp=new THREE.Mesh(new THREE.SphereGeometry(.38,14,10),new THREE.MeshBasicMaterial({color:0xfff2a3}));lamp.position.set(0,2.4,2.03);g.add(lamp);for(const x of[-2.45,2.45])for(const z of[-1.25,1.25]){const wheel=cylinder(.72,.72,.28,dark,18);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.58,z);g.add(shadow(wheel));const hub=cylinder(.27,.27,.31,gold,14);hub.rotation.z=Math.PI/2;hub.position.set(x,.58,z);g.add(hub)}radius=2.35;
  } else if(type==="drum"){
    const drumMat=matte(color,.4), rimMat=matte(0xffe6a6,.35,.35);const shell=cylinder(2.45,2.45,3.2,drumMat,28);shell.position.y=1.65;g.add(shadow(shell));for(const y of[.12,3.18]){const rim=new THREE.Mesh(new THREE.TorusGeometry(2.48,.13,10,32),rimMat);rim.rotation.x=Math.PI/2;rim.position.y=y;g.add(shadow(rim));}for(const x of[-1.2,0,1.2]){const cord=box(.09,2.75,.08,rimMat);cord.position.set(x,1.65,2.44);cord.rotation.z=x*.13;g.add(cord)}for(const dir of[-1,1]){const stick=cylinder(.11,.11,4.1,matte(0xc48b55,.62),10);stick.rotation.z=dir*.85;stick.position.set(dir*.65,4.35,.2);g.add(shadow(stick));}radius=2.15;
  } else if(type==="rings"){
    const pole=matte(0xf3b62d,.44), base= cylinder(2.7,2.9,.55,matte(0x38aee0,.46),26);base.position.y=.28;g.add(shadow(base));const post=cylinder(.22,.3,5.7,pole,14);post.position.y=3.1;g.add(shadow(post));const ringColors=[0xf13b50,0xff9138,0xffd447,0x56cf79,0x4c9ef2];ringColors.forEach((ringColor,i)=>{const ring=new THREE.Mesh(new THREE.TorusGeometry(2.1-i*.3,.3,12,28),matte(ringColor,.4));ring.rotation.x=Math.PI/2;ring.position.y=.85+i*.78;g.add(shadow(ring));});const top=new THREE.Mesh(new THREE.SphereGeometry(.48,14,10),pole);top.position.y=6.05;g.add(shadow(top));radius=2.15;
  } else if(type==="bunny"){
    const fur=matte(0xf2eee8,.88), pink=matte(0xff9fba,.78), dark=matte(0x211b22,.65);const body=new THREE.Mesh(new THREE.SphereGeometry(2.05,22,16),fur);body.scale.set(.9,1.18,.82);body.position.y=2.35;g.add(shadow(body));const head=new THREE.Mesh(new THREE.SphereGeometry(1.65,22,16),fur);head.position.set(0,5.05,.15);g.add(shadow(head));for(const x of[-.7,.7]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.62,18,12),fur);ear.scale.set(.7,2.05,.62);ear.position.set(x,7.15,0);ear.rotation.z=x*.12;g.add(shadow(ear));const inner=new THREE.Mesh(new THREE.SphereGeometry(.36,14,10),pink);inner.scale.set(.55,1.9,.36);inner.position.set(x,7.17,.53);inner.rotation.z=x*.12;g.add(inner);const eye=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),dark);eye.position.set(x*.72,5.35,1.67);g.add(eye)}const nose=new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),pink);nose.position.set(0,4.92,1.82);g.add(nose);radius=1.9;
  } else if(type==="toycar"){
    const toy=matte(color,.3,.35), dark=matte(0x171c24,.32,.55), glass=matte(0x72d8f5,.18,.4);const base=box(5.6,1.05,3.25,toy);base.position.y=1.05;g.add(shadow(base));const hood=box(4.9,.72,1.25,toy);hood.position.set(0,1.75,1.05);g.add(shadow(hood));const cabin=box(3.25,1.65,1.65,glass);cabin.position.set(0,2.45,-.45);g.add(shadow(cabin));for(const x of[-2.65,2.65])for(const z of[-1.05,1.05]){const wheel=cylinder(.68,.68,.34,dark,18);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.72,z);g.add(shadow(wheel));}for(const x of[-1.65,1.65]){const lamp=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8),new THREE.MeshBasicMaterial({color:0xfff4a8}));lamp.position.set(x,1.55,1.69);g.add(lamp)}radius=2.35;
  } else {
    const fur=matte(0x9a6038,.88), muzzleMat=matte(0xd9a875,.9), dark=matte(0x211712,.7);const belly=new THREE.Mesh(new THREE.SphereGeometry(2.25,22,16),fur);belly.scale.set(1,1.18,.82);belly.position.y=2.5;g.add(shadow(belly));const head=new THREE.Mesh(new THREE.SphereGeometry(1.85,22,16),fur);head.position.set(0,5.45,.1);g.add(shadow(head));for(const x of[-1.45,1.45]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.72,16,11),fur);ear.position.set(x,6.62,0);g.add(shadow(ear));const paw=new THREE.Mesh(new THREE.SphereGeometry(.72,16,11),fur);paw.position.set(x*1.28,1.15,.45);g.add(shadow(paw));}const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.82,16,11),muzzleMat);muzzle.scale.y=.7;muzzle.position.set(0,4.95,1.55);g.add(shadow(muzzle));for(const x of[-.62,.62]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.19,12,8),dark);eye.position.set(x,5.75,1.63);g.add(eye)}const nose=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),dark);nose.scale.y=.7;nose.position.set(0,5.15,2.23);g.add(nose);radius=2.05;
  }
  const visual=new THREE.Group();while(g.children.length)visual.add(g.children[0]);
  const characterTypes=["duck","robot","teddy","bunny"],isCharacter=characterTypes.includes(type);let poseY=0;
  if(isCharacter){
    // Keep dolls in a believable resting pose. A small lean adds variation without
    // making the model balance on its head/ear as the old random 90-degree poses did.
    visual.rotation.set((Math.random()-.5)*.035,(Math.random()-.5)*1.05,(Math.random()-.5)*.045);
    visual.updateMatrixWorld(true);const poseBounds=new THREE.Box3().setFromObject(visual);poseY=Math.max(.012,-poseBounds.min.y+.012);
    // Dolls need to cast real shadows onto the runner; otherwise the detached blob
    // underneath reads as an object floating above the floor.
    visual.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true}});
  }
  else if(type!=="ball"){visual.rotation.y=(Math.random()-.5)*(type==="book"||type==="pencil"?1.1:.55);visual.rotation.z=(Math.random()-.5)*.05}
  visual.position.y=poseY;g.add(visual);
  visual.updateMatrixWorld(true);const obstacleBounds=new THREE.Box3().setFromObject(visual),obstacleMinY=obstacleBounds.min.y,obstacleMaxY=obstacleBounds.max.y,tallCharacter=isCharacter&&obstacleMaxY>=5.8;
  const contactRadius=isCharacter?Math.max(.9,radius*.82):Math.max(1.05,radius*1.15);
  const blob=new THREE.Mesh(new THREE.CircleGeometry(contactRadius,28),new THREE.MeshBasicMaterial({color:0x050505,transparent:true,opacity:isCharacter?.38:.24,depthWrite:false}));blob.rotation.x=-Math.PI/2;blob.scale.y=isCharacter?.42:.58;blob.position.y=.028;blob.renderOrder=-1;g.add(blob);
  g.userData={type,radius,jumpable,clearance,visual,blob,blobOpacity:blob.material.opacity,blobScaleY:blob.scale.y,poseY,visualY:poseY,obstacleMinY,obstacleMaxY,tallCharacter,knockY:0,knockX:0,knockSpin:0,hit:false,spin:0};return g;
}

function createJetPickup(){
  const g=new THREE.Group(), c=document.createElement("canvas");c.width=512;c.height=256;const x=c.getContext("2d");
  x.clearRect(0,0,c.width,c.height);x.shadowColor="#ff1838";x.shadowBlur=30;x.fillStyle="#d90c2f";x.strokeStyle="#fff";x.lineWidth=14;x.textAlign="center";x.textBaseline="middle";x.font="italic 900 150px Impact, Arial Black, sans-serif";x.strokeText("JET",256,132);x.fillText("JET",256,132);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const mark=new THREE.Mesh(new THREE.PlaneGeometry(4.7,2.35),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));mark.rotation.x=-.08;g.add(mark);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.75,.11,10,36),new THREE.MeshBasicMaterial({color:0xff3150,transparent:true,opacity:.92}));g.add(ring);
  const glow=new THREE.PointLight(0xff2548,2.8,10);glow.position.z=1;g.add(glow);g.position.y=2.35;g.userData={kind:"jet",phase:Math.random()*Math.PI*2,baseY:2.35};return g;
}

function createBoostPickup(){
  const g=new THREE.Group(), shape=new THREE.Shape();shape.moveTo(.18,1.55);shape.lineTo(-.72,.2);shape.lineTo(-.12,.2);shape.lineTo(-.48,-1.5);shape.lineTo(.78,.05);shape.lineTo(.18,.05);shape.closePath();
  const bolt=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:true,bevelSegments:2,bevelSize:.07,bevelThickness:.06}),new THREE.MeshStandardMaterial({color:0xffdf35,emissive:0xff8a00,emissiveIntensity:2.4,roughness:.25,metalness:.25}));bolt.position.z=-.12;g.add(shadow(bolt));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.55,.09,10,36),new THREE.MeshBasicMaterial({color:0x66eaff,transparent:true,opacity:.85}));g.add(ring);const glow=new THREE.PointLight(0xffc328,2.2,8);glow.position.z=1;g.add(glow);g.position.y=2.05;g.userData={kind:"boost",phase:Math.random()*Math.PI*2,baseY:2.05};return g;
}

function createFruitObstacle(){
  const g=new THREE.Group(), kinds=["apple","orange","watermelon","banana"], type=kinds[Math.floor(Math.random()*kinds.length)];let radius=1.3;
  if(type==="apple"){
    const fruit=new THREE.Mesh(new THREE.SphereGeometry(1.28,22,16),matte(0xe92f45,.55));fruit.scale.set(1,1.05,.94);g.add(shadow(fruit));
    const stem=cylinder(.1,.14,.62,matte(0x5a341c,.75),10);stem.position.y=1.45;stem.rotation.z=-.2;g.add(shadow(stem));
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(.38,12,8),matte(0x4fae46,.7));leaf.scale.set(1,.18,.55);leaf.position.set(.32,1.55,0);leaf.rotation.z=.35;g.add(shadow(leaf));
  } else if(type==="orange"){
    const fruit=new THREE.Mesh(new THREE.SphereGeometry(1.22,24,18),matte(0xff8b22,.78));g.add(shadow(fruit));
    const cap=cylinder(.18,.28,.18,matte(0x4b9c3c,.72),10);cap.position.y=1.23;g.add(shadow(cap));radius=1.22;
  } else if(type==="watermelon"){
    const fruit=new THREE.Mesh(new THREE.SphereGeometry(1.55,24,18),matte(0x3f9f55,.62));fruit.scale.y=.92;g.add(shadow(fruit));
    for(const angle of[-.75,0,.75]){const stripe=new THREE.Mesh(new THREE.TorusGeometry(1.48,.055,8,28),matte(0x173f2d,.74));stripe.rotation.set(Math.PI/2,angle,0);g.add(shadow(stripe))}radius=1.5;
  } else {
    const fruit=new THREE.Mesh(new THREE.TorusGeometry(1.15,.38,14,28,Math.PI*1.35),matte(0xffd52c,.62));fruit.rotation.z=-.68;fruit.position.set(-.15,.15,0);g.add(shadow(fruit));
    for(const x of[-1.05,.9]){const tip=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),matte(0x70501e,.72));tip.position.set(x,x<0?.77:-.42,0);g.add(shadow(tip))}radius=1.35;
  }
  g.userData={type,radius,vy:-7-Math.random()*3,vx:0,gravity:22+Math.random()*5,spinX:(Math.random()-.5)*5.4,spinZ:(Math.random()-.5)*5.4,hit:false,grounded:false};return g;
}

const obstacleKinds=["block","block","ball","cup","book","pencil","duck","duck","robot","robot","train","drum","rings","teddy","teddy","bunny","bunny","toycar","toycar"], obstacles=[], pickups=[], fruits=[];
const laneX=[-5.6,-2.8,0,2.8,5.6];
let cockpitView=false,safeLane=2,running=false,elapsed=0,distance=0,energy=100,speed=0,baseSpeed=700,spawnClock=0,fruitClock=4.5,boostTimer=0,jetTimer=0,flightY=0,flightV=0,jumpY=0,jumpV=0,lastPickupAt=-20,lastPickupKind="",pickupKindStreak=0,invincible=0,shake=0,last=performance.now();
const control={left:false,right:false}, carMotion={x:0,vx:0,recoil:0,impactY:0,impactV:0,impactRoll:0,impactPitch:0};

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
    this.jetGain=this.ctx.createGain();this.jetGain.gain.value=.001;this.jetGain.connect(this.master);this.jetFilter=this.ctx.createBiquadFilter();this.jetFilter.type="bandpass";this.jetFilter.frequency.value=1150;this.jetFilter.Q.value=.45;this.jetFilter.connect(this.jetGain);
    const jetBuffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate),jetData=jetBuffer.getChannelData(0);for(let i=0;i<jetData.length;i++)jetData[i]=Math.random()*2-1;this.jetNoise=this.ctx.createBufferSource();this.jetNoise.buffer=jetBuffer;this.jetNoise.loop=true;this.jetNoise.connect(this.jetFilter);this.jetNoise.start();
    this.jetTone=this.ctx.createOscillator();this.jetTone.type="sawtooth";this.jetTone.frequency.value=72;const jetToneGain=this.ctx.createGain();jetToneGain.gain.value=.06;this.jetTone.connect(jetToneGain);jetToneGain.connect(this.jetGain);this.jetTone.start();
    const silent=this.ctx.createBufferSource();silent.buffer=this.ctx.createBuffer(1,1,this.ctx.sampleRate);silent.connect(this.master);silent.start(0);
    this.next=this.ctx.currentTime;this.beat=0;this.ctx.resume?.();return true
  }
  tone(f,t,d,g,type="square",out=this.music){if(!this.ctx||!out)return;const o=this.ctx.createOscillator(),v=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);v.gain.setValueAtTime(Math.max(.001,g),t);v.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(v);v.connect(out);o.start(t);o.stop(t+d+.03)}
  noise(d=.2,g=.16,frequency=1400,startAt=this.ctx?.currentTime||0){if(!this.ctx)return;const size=Math.floor(this.ctx.sampleRate*d),b=this.ctx.createBuffer(1,size,this.ctx.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*(1-i/a.length);const s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),v=this.ctx.createGain();s.buffer=b;f.type="bandpass";f.frequency.value=frequency;f.Q.value=.7;v.gain.value=g;s.connect(f);f.connect(v);v.connect(this.master);s.start(startAt)}
  kick(t){if(!this.ctx)return;const o=this.ctx.createOscillator(),v=this.ctx.createGain();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(48,t+.12);v.gain.setValueAtTime(.25,t);v.gain.exponentialRampToValueAtTime(.001,t+.16);o.connect(v);v.connect(this.music);o.start(t);o.stop(t+.17)}
  snare(t){this.noise(.13,.12,1700,t);this.tone(190,t,.1,.06,"triangle",this.music)}
  hat(t,open=false){this.noise(open?.12:.035,open?.035:.022,7200,t)}
  chord(notes,t,d=.7){notes.forEach((f,i)=>this.tone(f,t,d,.035,i===0?"sawtooth":"triangle",this.music))}
  startRace(){if(!this.init())return;this.ctx.resume?.();const t=this.ctx.currentTime+.02;[262,392,523,784].forEach((f,i)=>this.tone(f,t+i*.075,.3,.2,"sawtooth",this.music));this.next=t+.32;this.beat=0}
  enable(){if(!this.init())return;this.master.gain.setTargetAtTime(.78,this.ctx.currentTime,.03);this.ctx.resume?.();const t=this.ctx.currentTime+.01;this.tone(660,t,.1,.14,"sine",this.music);this.tone(990,t+.08,.16,.14,"sine",this.music)}
  jump(){if(!this.init())return;this.ctx.resume?.();const t=this.ctx.currentTime,o=this.ctx.createOscillator(),v=this.ctx.createGain();o.type="sine";o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(620,t+.11);o.frequency.exponentialRampToValueAtTime(280,t+.26);v.gain.setValueAtTime(.3,t);v.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(v);v.connect(this.master);o.start(t);o.stop(t+.31);this.noise(.08,.07,3200,t)}
  boost(){if(!this.init())return;this.ctx.resume?.();const t=this.ctx.currentTime;[180,270,405,610,820].forEach((f,i)=>this.tone(f,t+i*.045,.28,.18,"sawtooth",this.engineGain));this.noise(.55,.18,1900)}
  jet(){if(!this.init())return;this.ctx.resume?.();const t=this.ctx.currentTime;[90,135,210,330,510].forEach((f,i)=>this.tone(f,t+i*.055,.42,.14,"sawtooth",this.jetGain));this.noise(.75,.22,950)}
  crash(){if(!this.init())return;this.ctx.resume?.();this.noise(.42,.42,650);const t=this.ctx.currentTime;this.tone(82,t,.48,.38,"sawtooth",this.engineGain);this.tone(47,t,.55,.28,"square",this.engineGain)}
  over(){if(!this.init())return;const t=this.ctx.currentTime;[392,294,220,147,82].forEach((f,i)=>this.tone(f,t+i*.16,.4,.18,"sawtooth"))}
  update(){if(!this.ctx)return;if(this.ctx.state==="suspended")return;const powered=boostTimer>0||jetTimer>0,r=speed/1200;this.engine.frequency.setTargetAtTime(78+r*220+(powered?62:0),this.ctx.currentTime,.04);this.engine2.frequency.setTargetAtTime(78+r*220,this.ctx.currentTime,.05);this.filter.frequency.setTargetAtTime(460+r*1900,this.ctx.currentTime,.05);this.engineGain.gain.setTargetAtTime(running?.11+(powered?.06:0):.001,this.ctx.currentTime,.08);this.jetGain.gain.setTargetAtTime(running&&jetTimer>0?.16:.001,this.ctx.currentTime,.12);this.jetFilter.frequency.setTargetAtTime(950+speed*.35,this.ctx.currentTime,.1);this.jetTone.frequency.setTargetAtTime(68+speed*.035,this.ctx.currentTime,.1);const chords=[[220,261.63,329.63],[174.61,220,261.63],[261.63,329.63,392],[196,246.94,293.66]],bassRoots=[55,43.65,65.41,49],lead=[440,523.25,659.25,783.99,659.25,523.25,880,783.99,659.25,587.33,523.25,659.25,987.77,880,783.99,659.25];while(running&&this.next<this.ctx.currentTime+.14){const step=this.beat%16,bar=Math.floor(this.beat/16)%4,t=this.next;if(step===0)this.chord(chords[bar],t,1.15);if(step%4===0)this.kick(t);if(step===4||step===12)this.snare(t);this.hat(t,step===15);if(step%2===0)this.tone(bassRoots[bar]*(step===6||step===14?2:1),t,.11,.12,"sawtooth",this.music);if([1,3,5,7,9,11,13,15].includes(step))this.tone(lead[(step+bar*3)%16],t,.09,powered?.075:.055,"square",this.music);this.next+=powered?.075:.095;this.beat++}}
}
const audio=new AudioSystem();

function spawn(){
  if(Math.random()<.58){const step=Math.random()<.5?-1:1;safeLane=THREE.MathUtils.clamp(safeLane+step,0,4)}
  const candidates=[0,1,2,3,4].filter(i=>Math.abs(i-safeLane)>1).sort(()=>Math.random()-.5);
  const count=candidates.length>1&&Math.random()<Math.min(.88,.7+elapsed*.004)?2:1;
  const chosen=[candidates[0]];if(count===2){const second=candidates.find(lane=>Math.abs(lane-chosen[0])>=3);if(second!==undefined)chosen.push(second)}
  for(const lane of chosen){const o=createObstacle(obstacleKinds[Math.floor(Math.random()*obstacleKinds.length)]);o.position.set(laneX[lane],0,-102);scene.add(o);obstacles.push(o);}
  if(elapsed-lastPickupAt>4.4&&pickups.length===0&&flightY<.8&&Math.random()<.52){const kind=choosePickupKind(Math.random(),lastPickupKind,pickupKindStreak,jetTimer>0),p=kind==="jet"?createJetPickup():createBoostPickup();pickupKindStreak=kind===lastPickupKind?pickupKindStreak+1:1;lastPickupKind=kind;p.position.x=laneX[safeLane];p.position.z=-98;scene.add(p);pickups.push(p);lastPickupAt=elapsed}
}
function spawnFruit(){
  const f=createFruitObstacle(), lane=Math.floor(Math.random()*laneX.length), spawnZ=-68-Math.random()*12, travelTime=(car.position.z-spawnZ)/(Math.max(700,speed)*.08), targetY=Math.random()<.62?f.userData.radius:5.5+Math.random()*1.8;
  f.position.set(laneX[lane]+(Math.random()-.5)*.45,fallingFruitSpawnY(targetY,f.userData.vy,f.userData.gravity,travelTime),spawnZ);scene.add(f);fruits.push(f);
}
function applyDamage(source){
  if(source.userData.hit||invincible>0)return;
  const {carDirection:away,objectDirection}=impactDirections(source.position.x,car.position.x,Math.random()<.5?-1:1),data=source.userData;
  data.hit=true;carMotion.vx=away*8.4;carMotion.recoil=.72;carMotion.impactY=Math.max(.02,carMotion.impactY);carMotion.impactV=3.8;carMotion.impactRoll=-away*.26;carMotion.impactPitch=.16;
  if(data.visual){data.knockX=objectDirection*5.6;data.knockY=4.3;data.knockSpin=objectDirection*2.8}
  else{data.vx=objectDirection*5.2;data.vy=Math.max(4.1,data.vy);data.grounded=false;data.spinZ=objectDirection*5.4}
  energy=Math.max(0,energy-10);invincible=1.05;shake=.42;ui.energy.style.width=energy+"%";audio.crash();navigator.vibrate?.([55,30,75]);if(energy<=0)endGame();
}
function hitGroundObstacle(o){
  if(o.userData.hit||invincible>0||!groundObstacleCanDamage({jetTimer,flightY,jumpY,impactY:carMotion.impactY,jumpable:o.userData.jumpable,clearance:o.userData.clearance,tallCharacter:o.userData.tallCharacter,obstacleMinY:o.userData.obstacleMinY,obstacleMaxY:o.userData.obstacleMaxY,carCenterY:car.position.y+.34}))return;
  if(Math.abs(o.position.z-car.position.z)<1.85&&Math.abs(o.position.x-car.position.x)<o.userData.radius+.3)applyDamage(o);
}
function hitFruit(f){
  if(f.userData.hit||invincible>0)return;const radius=f.userData.radius,carCenterY=car.position.y+.34;
  if(fruitHitsCar({x:f.position.x,y:f.position.y,z:f.position.z,radius},{x:car.position.x,y:carCenterY,z:car.position.z}))applyDamage(f);
}
function updateWorld(dt){
  if(!running)return;elapsed+=dt;invincible=Math.max(0,invincible-dt);boostTimer=Math.max(0,boostTimer-dt);jetTimer=Math.max(0,jetTimer-dt);baseSpeed=Math.min(1125,700+elapsed*6.5);speed=baseSpeed+(boostTimer>0?475:0)+(jetTimer>0?360:0);const units=speed*.08*dt;
  const dir=(control.left?-1:0)+(control.right?1:0);carMotion.vx+=dir*dt*34;carMotion.vx*=Math.pow(.025,dt);carMotion.x=THREE.MathUtils.clamp(carMotion.x+carMotion.vx*dt,-6.25,6.25);car.position.x+=(carMotion.x-car.position.x)*dt*15;carMotion.recoil*=Math.pow(.025,dt);car.position.z=3.2+carMotion.recoil;
  if(jetTimer>0){jumpY=jumpV=0} else {jumpV-=18*dt;jumpY+=jumpV*dt;if(jumpY<=0){jumpY=0;jumpV=0}}
  ({altitude:flightY,velocity:flightV}=flightMotionStep(flightY,flightV,jetTimer>0,dt));
  carMotion.impactV-=18*dt;carMotion.impactY+=carMotion.impactV*dt;if(carMotion.impactY<=0){carMotion.impactY=0;carMotion.impactV=0}
  carMotion.impactRoll*=Math.pow(.035,dt);carMotion.impactPitch*=Math.pow(.04,dt);car.position.y=flightY+jumpY+carMotion.impactY;
  car.rotation.z+=(dir*-.17+carMotion.impactRoll-car.rotation.z)*dt*11;car.rotation.x+=((jetTimer>0?-.1:jumpY>0?-jumpV*.018:0)+carMotion.impactPitch-car.rotation.x)*dt*8;ui.jump.classList.toggle("airborne",jumpY>0||flightY>.35);
  floorMat.map.offset.y-=units/11;for(const m of laneMarkers){m.position.z+=units;if(m.position.z>14)m.position.z-=130;}
  for(const detail of floorDetails){detail.position.z+=units;if(detail.position.z>25)detail.position.z-=176;}
  for(const prop of scenery){prop.position.z+=units*.62;if(prop.position.z>34)prop.position.z-=190;}
  spawnClock-=dt;if(spawnClock<=0){spawn();spawnClock=Math.max(.46,.62-elapsed*.0015)*(.94+Math.random()*.14);}
  fruitClock-=dt;if(elapsed>3.5&&fruitClock<=0){spawnFruit();fruitClock=3.8+Math.random()*2.8;}
  for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i],data=o.userData;o.position.z+=units;o.rotation.y+=data.spin*dt;if(data.hit){o.position.x+=data.knockX*dt;data.knockX*=Math.pow(.08,dt);data.knockY-=14*dt;data.visualY+=data.knockY*dt;if(data.visualY<=data.poseY){data.visualY=data.poseY;data.knockY=Math.abs(data.knockY)>.9?Math.abs(data.knockY)*.26:0}data.visual.position.y=data.visualY;data.visual.rotation.z+=data.knockSpin*dt;data.knockSpin*=Math.pow(.1,dt);const lift=data.visualY-data.poseY;data.blob.material.opacity=data.blobOpacity/(1+lift*.8);data.blob.scale.x=1+lift*.08;data.blob.scale.y=data.blobScaleY*(1+lift*.08)}hitGroundObstacle(o);if(o.position.z>15){disposeObject(o);obstacles.splice(i,1);}}
  for(let i=fruits.length-1;i>=0;i--){const f=fruits[i],data=f.userData;f.position.z+=units;f.position.x+=data.vx*dt;data.vx*=Math.pow(.16,dt);if(!data.grounded){data.vy-=data.gravity*dt;f.position.y+=data.vy*dt;f.rotation.x+=data.spinX*dt;f.rotation.z+=data.spinZ*dt;if(f.position.y<=data.radius){f.position.y=data.radius;if(Math.abs(data.vy)>2.2){data.vy=-data.vy*.24;data.spinX*=.7;data.spinZ*=.7}else{data.vy=0;data.grounded=true}}}else{data.spinX*=Math.pow(.06,dt);data.spinZ*=Math.pow(.06,dt)}hitFruit(f);if(f.position.z>18||Math.abs(f.position.x)>18){disposeObject(f);fruits.splice(i,1);}}
  for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.position.z+=units;p.rotation.y+=dt*2.6;p.position.y=p.userData.baseY+Math.sin(elapsed*4+p.userData.phase)*.24;if(flightY<.8&&Math.abs(p.position.z-car.position.z)<2&&Math.abs(p.position.x-car.position.x)<1.05){if(p.userData.kind==="jet"){jetTimer=7;boostTimer=0;audio.jet()}else{boostTimer=5;audio.boost()}navigator.vibrate?.([35,25,70]);disposeObject(p);pickups.splice(i,1);continue}if(p.position.z>15){disposeObject(p);pickups.splice(i,1)}}
  const jetActive=jetTimer>0||flightY>.35,boostActive=boostTimer>0,displayKmh=Math.min(300,Math.round(165+Math.max(0,speed-700)*135/900));distance+=speed*dt/38;ui.distance.textContent=String(Math.floor(distance)).padStart(5,"0");ui.speed.textContent=String(displayKmh).padStart(3,"0");ui.boostState.classList.toggle("show",jetActive||boostActive);ui.boostState.classList.toggle("jet",jetActive);ui.boostState.textContent=jetTimer>0?`JET FLIGHT ${Math.ceil(jetTimer)}s`:jetActive?"SOFT LANDING":boostActive?`BOOST ${Math.ceil(boostTimer)}s`:"READY";
  for(const f of car.userData.flames){f.material.opacity=jetActive?.92:boostActive?.84:0;f.scale.y=(jetActive?1.05:.75)+Math.random()*.6;}for(const part of car.userData.jetParts)part.visible=jetActive;
  car.visible=!cockpitView&&!(invincible>0&&Math.floor(invincible*12)%2===0);const targetFov=cockpitView?(jetActive?86:77):(jetActive?75:64);camera.fov+=(targetFov-camera.fov)*dt*5;camera.updateProjectionMatrix();audio.update();
}
function render(){
  const sx=shake>0?(Math.random()-.5)*shake:0,sy=shake>0?(Math.random()-.5)*shake*.35:0;shake*=.88;
  if(cockpitView){camera.position.set(car.position.x+sx*.35,car.position.y+.82+sy,car.position.z+.34);camera.lookAt(car.position.x+car.rotation.z*3,car.position.y+.58,-30);camera.rotation.z=car.rotation.z*.26;}
  else{camera.position.set(car.position.x*.17+sx,2.15+car.position.y*.72+sy,8.2);camera.lookAt(car.position.x*.1,1.0+car.position.y*.62,-19);}
  sun.position.x=-18+car.position.x*.15;renderer.render(scene,camera);
}
function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;updateWorld(dt);render()}

function disposeObject(o){scene.remove(o);o.traverse(n=>{n.geometry?.dispose();if(n.material?.map)n.material.map.dispose();n.material?.dispose()})}
function clearObstacles(){for(const list of[obstacles,pickups,fruits])while(list.length)disposeObject(list.pop())}
function startGame(){audio.startRace();running=true;elapsed=distance=0;energy=100;baseSpeed=speed=700;spawnClock=.56;fruitClock=4.5;boostTimer=jetTimer=flightY=flightV=jumpY=jumpV=0;lastPickupAt=-20;lastPickupKind="";pickupKindStreak=0;invincible=0;safeLane=2;Object.assign(carMotion,{x:0,vx:0,recoil:0,impactY:0,impactV:0,impactRoll:0,impactPitch:0});car.position.set(0,0,3.2);car.rotation.set(0,0,0);car.userData.jetParts.forEach(part=>part.visible=false);car.userData.flames.forEach(flame=>flame.material.opacity=0);car.visible=!cockpitView;cockpit.visible=cockpitView;clearObstacles();ui.energy.style.width="100%";ui.boostState.classList.remove("show","jet");ui.boostState.textContent="READY";ui.finalScore.classList.remove("show");ui.eyebrow.textContent="";ui.title.innerHTML="MINI<em>Racer</em>";ui.tagline.textContent="";ui.start.textContent="ENGINE START";ui.overlay.classList.add("hidden")}
function endGame(){if(!running)return;running=false;speed=0;audio.over();navigator.vibrate?.([100,50,100,50,180]);ui.finalDistance.textContent=Math.floor(distance)+" m";ui.finalScore.classList.add("show");ui.eyebrow.textContent="ENGINE OVERHEATED";ui.title.innerHTML="RACE<em>OVER</em>";ui.tagline.textContent=distance>1500?"거대한 세상을 아주 멀리 달렸어요!":"다시 도전할까요?";ui.start.textContent="RESTART RACE";setTimeout(()=>ui.overlay.classList.remove("hidden"),550)}
function jumpCar(){if(!running||jumpY>0||jetTimer>0||flightY>.35)return;jumpV=6.1;audio.jump();navigator.vibrate?.(25)}
function toggleView(){cockpitView=!cockpitView;cockpit.visible=cockpitView;car.visible=!cockpitView;ui.viewToggle.textContent=cockpitView?"👁 운전석":"🚗 외부 시점";ui.viewToggle.setAttribute("aria-pressed",String(cockpitView))}
function bindHold(el,key){const on=e=>{e.preventDefault();control[key]=true;el.classList.add("active");audio.init()},off=e=>{e.preventDefault();control[key]=false;el.classList.remove("active")};el.addEventListener("pointerdown",on);el.addEventListener("pointerup",off);el.addEventListener("pointercancel",off);el.addEventListener("pointerleave",off)}
bindHold(ui.left,"left");bindHold(ui.right,"right");ui.jump.addEventListener("pointerdown",e=>{e.preventDefault();jumpCar()});ui.start.addEventListener("click",startGame);
ui.soundToggle.addEventListener("pointerdown",e=>{e.preventDefault();audio.enable();ui.soundToggle.textContent="🔊 SOUND ON"});
ui.viewToggle.addEventListener("pointerdown",e=>{e.preventDefault();toggleView()});
addEventListener("keydown",e=>{if(["ArrowLeft","a","A"].includes(e.key))control.left=true;if(["ArrowRight","d","D"].includes(e.key))control.right=true;if(e.code==="Space"){e.preventDefault();jumpCar()}if(e.key==="v"||e.key==="V")toggleView()});addEventListener("keyup",e=>{if(["ArrowLeft","a","A"].includes(e.key))control.left=false;if(["ArrowRight","d","D"].includes(e.key))control.right=false});
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight,false)});
document.addEventListener("visibilitychange",()=>{if(document.hidden){control.left=control.right=false;last=performance.now()}});
renderer.setAnimationLoop(loop);
