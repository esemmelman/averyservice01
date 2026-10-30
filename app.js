const $ = id => document.getElementById(id);
const player = new Audio();
let stream, recording, previewURL, localStudio = false;
let audioContext, input, processor, samples = [], capturing = false;
let recordingStarted = 0, recordingTimer;
function releaseMicrophone() {
  clearInterval(recordingTimer);
  capturing = false;
  if (processor) { processor.onaudioprocess = null; processor.disconnect(); processor = null; }
  if (input) { input.disconnect(); input = null; }
  stream?.getTracks().forEach(track => track.stop());
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
  $('record').disabled = false;
  $('stop').disabled = true;
}
async function initialize() {
  try {
    const response = await fetch('blessing.json', {cache:'no-store'});
    if (response.ok) {const config = await response.json(); player.src = config.audio;}
  } catch {}
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    try {localStudio = (await fetch('/api/studio')).ok;} catch {}
  }
  if (!player.getAttribute('src')) {
    $('status').textContent = 'The blessing is waiting for your voice.';
    $('studio').hidden = !localStudio;
    if (!localStudio) $('status').textContent = 'The personal blessing will be available soon.';
  }
}
$('tallit').onclick = async () => {
  if (!player.getAttribute('src')) {if(localStudio) $('studio').scrollIntoView({behavior:'smooth'}); return;}
  if (!player.paused) {player.pause(); return;}
  try {await player.play();} catch {$('status').textContent = 'Unable to play the blessing. Please try again.';}
};
player.onplay = () => {$('play-icon').textContent='Ⅱ'; $('play-label').textContent='PAUSE THE BLESSING'; $('tallit').setAttribute('aria-label','Pause the tallit blessing'); $('status').textContent='Listening to the blessing…';};
function stopped(){ $('play-icon').textContent='▶'; $('play-label').textContent='LISTEN TO THE BLESSING'; $('tallit').setAttribute('aria-label','Play the tallit blessing'); $('status').textContent='Touch the tallit whenever you’re ready.'; }
player.onpause=stopped; player.onended=stopped;
$('record').onclick = async () => {
  $('record').disabled=true;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !Context) throw new Error('Please open the recording studio in Chrome or Edge.');
    // Resume inside the button gesture, before waiting for microphone permission.
    audioContext = new Context();
    await audioContext.resume();
    stream = await navigator.mediaDevices.getUserMedia({audio:true});
    player.pause(); $('review').pause(); samples=[];
    input = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = event => {
      if (capturing) samples.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      // Leave the output silent to prevent microphone feedback.
      event.outputBuffer.getChannelData(0).fill(0);
    };
    input.connect(processor); processor.connect(audioContext.destination);
    capturing = true; recordingStarted=Date.now();
    recordingTimer=setInterval(()=>{$('recording-state').textContent=`● Recording — ${Math.floor((Date.now()-recordingStarted)/1000)} seconds. Press Stop when finished.`;},1000);
    $('record').disabled=true; $('stop').disabled=false; $('approval').hidden=true; $('review').hidden=true; $('listen').hidden=true;
    $('recording-state').textContent='● Recording — say the blessing, then press Stop.';
  } catch(error){releaseMicrophone(); $('recording-state').textContent=error.name==='NotAllowedError'?'Allow microphone access, then try again.':error.message;}
};
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
$('stop').onclick=()=>{
  if(!capturing) return;
  const rate=audioContext.sampleRate;
  releaseMicrophone();
  if(!samples.length) {
    $('recording-state').textContent='No microphone audio arrived. Check your microphone selection and record for a few seconds.';
    return;
  }
  recording=encodeWav(samples,rate); samples=[];
  if(previewURL) URL.revokeObjectURL(previewURL);
  previewURL=URL.createObjectURL(recording);
  $('review').src=previewURL; $('review').load();
  $('review').hidden=false; $('approval').hidden=false; $('listen').hidden=false;
  $('approve').disabled=false; $('retry').disabled=false;
  $('recording-state').textContent='Your WAV recording is ready. Press Play my recording to listen.';
  $('listen').scrollIntoView({behavior:'smooth',block:'center'});
};
$('listen').onclick=async()=>{
  try {await $('review').play(); $('recording-state').textContent='Playing your recording…';}
  catch(error){$('recording-state').textContent='Playback failed: '+error.message+'. Please record another take.';}
};
$('review').onended=()=>{$('recording-state').textContent='Keep this take or record again.';};
$('review').onerror=()=>{$('recording-state').textContent='This browser could not play the recording. Please try another take in Chrome or Edge.';};
$('retry').onclick=()=>{$('review').pause(); $('record').click();};
$('approve').onclick=async()=>{
  if(!recording?.size) return;
  $('approve').disabled=true; $('retry').disabled=true; $('record').disabled=true;
  $('recording-state').textContent='Saving and publishing your blessing…';
  try {
    const response=await fetch('/api/approve',{method:'POST',headers:{'Content-Type':recording.type},body:recording});
    if(!response.ok) throw new Error(await response.text());
    const result=await response.json();
    $('review').pause(); player.src=result.audio; $('studio').hidden=true;
    $('status').textContent='Your blessing is saved. Touch the tallit to listen. The public site updates in a few minutes.';
  } catch(error){$('recording-state').textContent='Publishing needs another try: '+error.message; $('approve').disabled=false; $('retry').disabled=false; $('record').disabled=false;}
};
initialize();
