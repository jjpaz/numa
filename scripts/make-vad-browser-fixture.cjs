// Synthetic WebAudio -> real Chromium MediaRecorder. No microphone or Numa server.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

(async () => {
  const root = path.resolve(__dirname, '..', '.local', 'ml-fixtures');
  const target = path.join(root, 'chromium-synthetic.webm');
  if (fs.existsSync(target)) throw new Error('Fixture already exists; not overwritten.');
  const source = fs.readFileSync(path.join(root, 'synthetic-en.wav'));
  if (crypto.createHash('sha256').update(source).digest('hex') !==
      '05e22f170a9cb7c817754eb44024d468bede1e1b7ca6070dfeafa906e2fe3789') {
    throw new Error('Expected controlled synthetic fixture.');
  }
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const recording = await page.evaluate(async (encoded) => {
      const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      const context = new AudioContext({ sampleRate: 48000 });
      const source = context.createBufferSource();
      source.buffer = await context.decodeAudioData(bytes.buffer);
      const destination = context.createMediaStreamDestination();
      source.connect(destination);
      const recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks = [];
      const done = new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error('MediaRecorder failed'));
        recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));
      });
      source.onended = () => setTimeout(() => recorder.stop(), 200);
      await context.resume();
      recorder.start(500);
      source.start();
      const data = await done;
      destination.stream.getTracks().forEach((track) => track.stop());
      await context.close();
      return data;
    }, source.toString('base64'));
    fs.writeFileSync(target, Buffer.from(recording), { flag: 'wx' });
    console.log(JSON.stringify({ status: 'created', browser: browser.version(),
      mime: 'audio/webm;codecs=opus', bytes: recording.length, microphone_used: false }));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
