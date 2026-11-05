/* Offline classroom lesson. No accounts, uploads or persistent student data. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), T = window.THREE;
  const steps = [
    {title:'Peel the bananas', instruction:'Pull the peel down.', action:'Peel banana', cue:'Say: “I can peel!”', watch:'Mime peeling a banana.', target:'PEELING TRAY', done:'Banana peeled!'},
    {title:'Mash the bananas', instruction:'Press the banana with a fork.', action:'Mash banana', cue:'Press, press, press!', watch:'Mime mashing. Is it soft yet?', target:'BANANA BOWL', done:'Soft banana topping!'},
    {title:'Make the batter', instruction:'Add the packet’s measured water to the mix.', action:'Add water', cue:'Say: “Measure, then pour!”', watch:'What do we add? Water!', target:'MIX + MEASURED WATER', done:'Water added to the mix!'},
    {title:'Mix gently', instruction:'Stir the batter gently.', action:'Stir batter', cue:'Stir slowly. Take a turn.', watch:'Mime a slow stir.', target:'BATTER BOWL', done:'Batter mixed!'},
    {title:'Cook and flip', instruction:'With your teacher, cook a pancake on low heat.', action:'Cook and flip', cue:'Your teacher stays beside you. Use the spatula.', watch:'Watch from a safe distance. When do we flip?', target:'HOT PAN • WITH TEACHER SUPPORT', done:'Pancake cooked on both sides!'},
    {title:'Cool and serve', instruction:'Let it cool, then add banana on top.', action:'Cool and serve', cue:'Ask: “Is it cool enough?” Then add banana.', watch:'Say the steps: peel, mash, pour, stir, cook, serve!', target:'COOLING PLATE + BANANA', done:'A pancake with banana. Enjoy!'}
  ];
  let groups=[], groupIndex=0, step=0, busy=false, sound=false, audio;
  let renderer, scene, camera, root, active, destination, drag=null, animation=null;
  let generation=0, timer;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state=()=>groups[groupIndex];
  const finished=g=>g.turns.every(n=>n===g.size);
  function message(text) { $('#feedback').textContent=text; $('#scene-message').textContent=text; }
  function cancel() {
    generation++; clearTimeout(timer); animation=null; busy=false;
    if(drag && renderer) {
      if(renderer.domElement.hasPointerCapture(drag.id)) renderer.domElement.releasePointerCapture(drag.id);
      drag=null;
    }
  }
  function chime() {
    if(!sound) return;
    try {
      audio ||= new (window.AudioContext||window.webkitAudioContext)(); audio.resume();
      const o=audio.createOscillator(), gain=audio.createGain();
      o.frequency.value=700; gain.gain.setValueAtTime(.05,audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.2);
      o.connect(gain); gain.connect(audio.destination); o.start(); o.stop(audio.currentTime+.21);
    } catch { /* Sound is optional. */ }
  }
  function controls() {
    const g=state(), ready=!!g, done=ready&&g.turns[step]===g.size;
    $('#action').disabled=!ready||busy||done;
    $('#replay').disabled=!ready||busy;
    $('#back').disabled=!ready||step===0;
    $('#next').disabled=!ready||busy;
    $('#action').textContent=busy?'Working…':steps[step].action;
    $('#next').textContent=step===5?'Next group →':'Next →';
    $('#turn').textContent=ready?(done?`Group ${groupIndex+1}: everyone had a turn ✓`:`Group ${groupIndex+1} · Student ${g.turns[step]+1} of ${g.size}`):'';
    $('#stick-progress').textContent=ready?`${g.turns[step]} / ${g.size} turns`:'';
    $('#groupnav').replaceChildren();
    groups.forEach((g,i)=>{
      const b=document.createElement('button'); b.textContent=`Group ${i+1} (${g.size})${finished(g)?' ✓':''}`;
      b.className=i===groupIndex?'current':''; b.setAttribute('aria-pressed',String(i===groupIndex));
      b.onclick=()=>{cancel();groupIndex=i;step=Math.max(0,g.turns.findIndex(n=>n<g.size)); render();};
      $('#groupnav').append(b);
    });
  }
  function render() {
    cancel(); const s=steps[step];
    $('#title').textContent=`${step+1}. ${s.title}`; $('#instruction').textContent=s.instruction;
    $('#stepcount').textContent=`${step+1} / 6`; $('#activecue').textContent=s.cue; $('#watchcue').textContent=s.watch;
    $('#stagelabel').textContent=s.target; $('#setup').hidden=!!groups.length; $('#classbar').hidden=!groups.length;
    $('#steps').replaceChildren();
    steps.forEach((s,i)=>{
      const b=document.createElement('button'); b.textContent=i+1; b.setAttribute('aria-label',s.title);
      b.className=i===step?'current':''; b.disabled=!state()||i>step;
      b.onclick=()=>{step=i;render();}; $('#steps').append(b);
    });
    controls();
    message(!state()?'Form groups, then start peeling.':state().turns[step]===state().size?'Everyone had a turn. Click Next.':'Drag left → right, or click '+s.action.toLowerCase()+'.');
    if(renderer) buildScene();
  }
  function start() {
    const n=Number($('#students').value), k=Number($('#groups').value);
    if(!Number.isInteger(n)||n<1||n>60||!Number.isInteger(k)||k<1||k>8||k>n) {
      message('Choose 1–60 students and 1–8 groups. Each group needs a student.');return;
    }
    groups=Array.from({length:k},(_,i)=>({size:Math.floor(n/k)+(i<n%k?1:0),turns:Array(6).fill(0)}));
    groupIndex=0;step=0;render();
  }
  function perform() {
    const g=state(); if(!g||busy||g.turns[step]>=g.size)return;
    if(g.turns.slice(0,step).some(n=>n<g.size)) {message('Finish the earlier steps first.');return;}
    busy=true;controls();
    message(step===4?'With teacher support: pour, wait for bubbles, flip once.':step===5?'Let it cool. Check the temperature. Add banana.':steps[step].instruction);
    const token=generation;
    const complete=()=>{
      if(token!==generation)return;
      g.turns[step]++;busy=false;animation=null;chime();
      if(renderer) buildScene();controls();
      message(steps[step].done+' '+(g.turns[step]===g.size?(step===5?'Group complete! Click Next group.':'Everyone had a turn. Click Next.'):`Student ${g.turns[step]+1}, your turn!`));
    };
    if(renderer&&active) {
      animation={object:active,from:active.position.clone(),start:performance.now(),duration:reduced?120:step===4?2100:800,complete};
    } else timer=setTimeout(complete,reduced?120:800);
  }
  function dispose() {
    if(!root)return;
    const materials=new Set(), geometries=new Set();
    root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.remove(root);
  }
  function mesh(geometry,color,x,y,z,parent=root) {
    const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color:new T.Color(color).convertSRGBToLinear(),roughness:.65}));
    m.position.set(x,y,z);parent.add(m);return m;
  }
  const box=(w,h,d,c,x,y,z,p)=>mesh(new T.BoxGeometry(w,h,d),c,x,y,z,p);
  const disc=(r,h,c,x,y,z,p)=>mesh(new T.CylinderGeometry(r,r,h,24),c,x,y,z,p);
  function banana(parent,peeled=false) {
    const curve=new T.QuadraticBezierCurve3(new T.Vector3(-.7,.1,0),new T.Vector3(0,-.25,0),new T.Vector3(.7,.35,0));
    mesh(new T.TubeGeometry(curve,16,.18,8,false),peeled?0xffefb4:0xf8cb3e,0,0,0,parent);
    if(!peeled) for(let i=0;i<4;i++)disc(.035,.03,0x805c32,-.4+i*.25,.2,0,parent);
    else for(let i=0;i<3;i++) {const peel=box(.2,.04,.8,0xf8cb3e,.3+i*.2,-.1,.35,parent);peel.rotation.y=i*.7;}
  }
  function bowl(x,z,color=0xf2a95c) {
    mesh(new T.SphereGeometry(.85,24,12,0,Math.PI*2,Math.PI/2,Math.PI/2),color,x,.85,z);
    disc(.8,.06,step===1?0xeac67a:0xffdf9e,x,.84,z);
  }
  function pancake(x,y,z,parent=root) {
    disc(.65,.15,0xc88439,x,y,z,parent);disc(.59,.02,0xefbd68,x,y+.08,z,parent);
  }
  function buildScene() {
    dispose();root=new T.Group();scene.add(root);
    box(12,.3,6,0xb98154,0,0,0);box(12,4,.2,0xe1ebdc,0,2,-3);
    for(let i=0;i<5;i++)box(2.3,.025,6,0xae754c,-4.8+i*2.4,.16,0);
    box(1.5,1.2,.8,0x8ca18b,-4,.7,-2);box(.1,1.2,.1,0x486458,-4,.7,-1.55);
    box(1.4,.08,1.2,0xb2c5ac,-2.6,.25,0);
    destination=new T.Vector3(2.2,.95,0);
    const ring=mesh(new T.TorusGeometry(1.15,.045,6,36),0x35865b,2.2,.22,0);ring.rotation.x=-Math.PI/2;
    if(step===0){box(2.2,.08,1.8,0xefd6a3,2.2,.25,0);banana(root,true);}
    if(step===1)bowl(2.2,0);
    if(step===2||step===3) {bowl(2.2,0,0x79aab3);box(.65,.95,.4,0xf3e4c5,4,.7,-1);}
    if(step===4){box(2.8,.35,2.6,0x43545a,2.2,.3,0);disc(1,.14,0x22282b,2.2,.56,0);box(1.1,.12,.22,0x282e30,3.6,.6,0);pancake(2.2,.7,0);}
    if(step===5){disc(1.15,.09,0xf7faf3,2.2,.27,0);pancake(2.2,.42,0);bowl(4,-1);}
    active=new T.Group();root.add(active);active.position.set(-2.6,1,0);
    if(step===0)banana(active);
    if(step===1){banana(active,true);box(.13,.07,1.2,0xcbd3d5,0,.35,.1,active);for(let i=0;i<3;i++)box(.035,.06,.28,0xcbd3d5,-.09+i*.09,.35,-.6,active);}
    if(step===2){disc(.4,.7,0x84cddd,0,.2,0,active);box(.07,.55,.07,0xffffff,.2,.3,.35,active);}
    if(step===3){box(.1,.1,1.3,0x9f623a,0,.2,0,active);disc(.24,.07,0xb67b49,0,.2,-.65,active);}
    if(step===4){box(.15,.08,1.2,0x9f623a,0,0,.25,active);box(.65,.06,.65,0xb4bec2,0,0,-.5,active);pancake(0,.13,-.5,active);}
    if(step===5){disc(.4,.07,0xedd27f,0,0,0,active);for(let i=0;i<4;i++)disc(.14,.1,0xffedbb,(i%2-.5)*.3,.1,(Math.floor(i/2)-.5)*.3,active);}
  }
  function resize() {
    if(!renderer)return;const v=$('#viewport'), w=v.clientWidth,h=v.clientHeight;
    // Keep the entire worktop visible on both a projector and a narrow phone.
    const halfW=Math.max(6.5,4*w/h), halfH=halfW*h/w;
    camera.left=-halfW;camera.right=halfW;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
  }
  function frame(now) {
    requestAnimationFrame(frame);if(!renderer)return;
    if(animation) {
      const a=animation,t=Math.min(1,(now-a.start)/a.duration);
      a.object.position.lerpVectors(a.from,destination,1-Math.pow(1-t,3));
      if(step===4){a.object.position.y+=Math.sin(t*Math.PI)*1.4;a.object.rotation.x=Math.PI*2*t;}
      if(step===3)a.object.rotation.y=t*Math.PI*4;
      if(t===1)a.complete();
    }
    renderer.render(scene,camera);
  }
  function initGraphics() {
    renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
    renderer.outputEncoding=T.sRGBEncoding;$('#viewport').append(renderer.domElement);
    scene=new T.Scene();scene.background=new T.Color(0xdce7d7);
    scene.add(new T.HemisphereLight(0xffffff,0x858c73,.75));const light=new T.DirectionalLight(0xffffff,.6);light.position.set(-3,7,5);scene.add(light);
    camera=new T.OrthographicCamera(-7,7,5,-5,.1,100);camera.position.set(0,8,11);camera.lookAt(0,.5,0);resize();
    const ray=new T.Raycaster(), pointer=new T.Vector2(), plane=new T.Plane(new T.Vector3(0,1,0),-1);
    const ground=e=>{
      const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
      ray.setFromCamera(pointer,camera);const p=new T.Vector3();return ray.ray.intersectPlane(plane,p);
    };
    const canvas=renderer.domElement;canvas.style.cursor='grab';
    canvas.onpointerdown=e=>{
      if(e.button!==0||busy||!state()||state().turns[step]>=state().size)return;
      const p=ground(e);if(!p||!ray.intersectObject(active,true).length)return;
      drag={id:e.pointerId,origin:active.position.clone(),offset:active.position.clone().sub(p)};canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointermove=e=>{if(!drag)return;const p=ground(e);if(p)active.position.copy(p.add(drag.offset));};
    canvas.onpointerup=e=>{
      if(!drag)return;const d=drag;drag=null;canvas.releasePointerCapture(e.pointerId);
      const good=Math.abs(active.position.x-destination.x)<1.3&&Math.abs(active.position.z)<1.4;
      if(good)perform();else{active.position.copy(d.origin);message('Move to the green ring on the right.');}
    };
    canvas.onpointercancel=()=>{if(drag){active.position.copy(drag.origin);drag=null;}};
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancel();renderer=null;$('#fallback').hidden=false;controls();message('Use the big action button to continue.');});
    requestAnimationFrame(frame);
  }
  $('#start').onclick=start;$('#action').onclick=perform;
  $('#next').onclick=()=>{
    const g=state();if(!g||busy)return;
    if(g.turns[step]<g.size){message('Everyone needs a turn before Next.');return;}
    if(step<5){step++;render();return;}
    const next=groups.findIndex(g=>!finished(g));
    if(next<0){message('All groups finished! Everyone made banana pancakes.');$('#next').textContent='All groups finished ✓';return;}
    groupIndex=next;step=Math.max(0,state().turns.findIndex(n=>n<state().size));render();
  };
  $('#back').onclick=()=>{if(step){step--;render();}};
  $('#replay').onclick=()=>{if(!state()||busy)return;state().turns.fill(0,step);render();message('Replay: this step and later steps are reset for this group.');};
  $('#restart').onclick=()=>{groups=[];step=0;groupIndex=0;render();};
  $('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=sound?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(sound));chime();};
  $('#kitchen-only').onclick=()=>{const on=document.body.classList.toggle('kitchen-focus');$('#kitchen-only').textContent=on?'Show lesson':'Big kitchen';$('#kitchen-only').setAttribute('aria-pressed',String(on));resize();};
  $('#full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else message('Use your browser’s full-screen command.');}catch{message('Use your browser’s full-screen command.');}};
  document.addEventListener('keydown',e=>{if(e.target.closest('button,input,a,summary'))return;if(e.key==='ArrowRight')$('#next').click();if(e.key==='ArrowLeft')$('#back').click();});
  window.addEventListener('resize',resize);
  try{if(!T)throw Error('Missing Three.js');initGraphics();}catch{renderer=null;$('#fallback').hidden=false;}
  render();
})();
