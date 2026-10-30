const cards = ['tallit','neshama','torah','learning'];
const players = [];
let activeRecorder = null;
let localStudio = false;
async function initialize() {
  if (['localhost','127.0.0.1'].includes(location.hostname)) {
    try {localStudio=(await fetch('/api/studio')).ok;} catch {}
  }
  await Promise.all(cards.map(setupCard));
}
async function setupCard(id) {
  const button=document.getElementById(id);
  const host=document.querySelector(`[data-studio="${id}"]`);
  host.append(document.getElementById('recorder-template').content.cloneNode(true));
  const studio=host.querySelector('.recorder');
  const control=name=>studio.querySelector(`[data-control="${name}"]`);
  const state=message=>{control('state').textContent=message;};
  const player=new Audio(); players.push(player);
  let recording, previewURL, stream, context, input, processor, samples=[], capturing=false, timer;
  const configURL=id==='tallit'?'blessing.json':`recordings/${id}.json`;
  try {
    const response=await fetch(configURL,{cache:'no-store'});
    if(response.ok) player.src=(await response.json()).audio;
  } catch {}
  studio.hidden=!localStudio || !!player.getAttribute('src');
  function release() {
    capturing=false; clearInterval(timer);
    if(processor){processor.onaudioprocess=null;processor.disconnect();processor=null;}
    if(input){input.disconnect();input=null;}
    stream?.getTracks().forEach(track=>track.stop());
    if(context && context.state!=='closed') context.close();
    if(activeRecorder===id) activeRecorder=null;
    control('record').disabled=false;control('stop').disabled=true;
  }
  button.onclick=async()=>{
    if(!player.getAttribute('src')) {if(localStudio)studio.scrollIntoView({behavior:'smooth',block:'center'});return;}
    if(!player.paused){player.pause();return;}
    players.forEach(other=>{if(other!==player)other.pause();});
    document.querySelectorAll('audio').forEach(audio=>audio.pause());
    try {await player.play();} catch(error) {if(error.name==='AbortError')return;state('Unable to play the recording. Please refresh and try again.');studio.hidden=false;}
  };
  button.onmouseleave=()=>{
    player.pause();
    if(player.getAttribute('src'))player.currentTime=0;
  };
  player.onplay=()=>button.setAttribute('aria-label',`Pause ${id} recording`);
  const stopped=()=>button.setAttribute('aria-label',`Play ${id} recording`);
  player.onpause=stopped;player.onended=stopped;
  control('record').onclick=async()=>{
    if(activeRecorder){state('Stop the other recording first.');return;}
    activeRecorder=id;control('record').disabled=true;
    try {
      const Context=window.AudioContext || window.webkitAudioContext;
      if(!navigator.mediaDevices?.getUserMedia || !Context)throw new Error('Please use Chrome or Edge with microphone access.');
      context=new Context();await context.resume();
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      players.forEach(audio=>audio.pause());
      document.querySelectorAll('audio').forEach(audio=>audio.pause());
      samples=[];recording=null;
      input=context.createMediaStreamSource(stream);
      processor=context.createScriptProcessor(4096,1,1);
      processor.onaudioprocess=event=>{
        if(capturing)samples.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        event.outputBuffer.getChannelData(0).fill(0);
      };
      input.connect(processor);processor.connect(context.destination);capturing=true;
      const started=Date.now();
      timer=setInterval(()=>state(`● Recording — ${Math.floor((Date.now()-started)/1000)} seconds. Press Stop when finished.`),1000);
      control('stop').disabled=false;control('approval').hidden=true;control('review').hidden=true;control('listen').hidden=true;
      state('● Recording — speak, then press Stop.');
    } catch(error){release();state(error.name==='NotAllowedError'?'Allow microphone access, then try again.':error.message);}
  };
  control('stop').onclick=()=>{
    if(!capturing)return;
    const rate=context.sampleRate;release();
    if(!samples.length){state('No microphone audio arrived. Check your microphone and record for a few seconds.');return;}
    recording=encodeWav(samples,rate);samples=[];
    if(previewURL)URL.revokeObjectURL(previewURL);
    previewURL=URL.createObjectURL(recording);
    control('review').src=previewURL;control('review').load();
    for(const name of ['review','approval','listen'])control(name).hidden=false;
    control('approve').disabled=false;control('retry').disabled=false;
    state('Your recording is ready. Press Play my recording to listen.');
    control('listen').scrollIntoView({behavior:'smooth',block:'center'});
  };
  control('listen').onclick=async()=>{
    players.forEach(audio=>audio.pause());
    document.querySelectorAll('audio').forEach(audio=>{if(audio!==control('review'))audio.pause();});
    try{await control('review').play();state('Playing your recording…');}catch(error){state('Playback failed: '+error.message);}
  };
  control('review').onended=()=>state('Keep this take or record again.');
  control('review').onerror=()=>state('Unable to play this take. Please record again.');
  control('retry').onclick=()=>control('record').click();
  control('approve').onclick=async()=>{
    if(!recording?.size)return;
    for(const name of ['approve','retry','record'])control(name).disabled=true;
    state('Saving and publishing your recording…');
    try {
      const response=await fetch(`/api/approve/${id}`,{method:'POST',headers:{'Content-Type':recording.type},body:recording});
      if(!response.ok)throw new Error(await response.text());
      const result=await response.json();
      control('review').pause();player.src=result.audio;studio.hidden=true;
    } catch(error){state('Publishing needs another try: '+error.message);for(const name of ['approve','retry','record'])control(name).disabled=false;}
  };
}
function encodeWav(buffers, sampleRate) {
  const count = buffers.reduce((total, buffer) => total + buffer.length, 0);
  const bytes = new ArrayBuffer(44 + count * 2);
  const view = new DataView(bytes);
  const text = (offset, value) => { for (let i=0;i<value.length;i++) view.setUint8(offset+i,value.charCodeAt(i)); };
  text(0,'RIFF'); view.setUint32(4,36+count*2,true); text(8,'WAVE');
  text(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
  view.setUint16(22,1,true); view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
  text(36,'data'); view.setUint32(40,count*2,true);
  let offset=44;
  for(const buffer of buffers) for(const sample of buffer) {
    const value=Math.max(-1,Math.min(1,sample));
    view.setInt16(offset, value<0 ? value*32768 : value*32767,true); offset+=2;
  }
  return new Blob([bytes],{type:'audio/wav'});
}

initialize();
