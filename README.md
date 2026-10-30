# The Tallit Blessing

A responsive HTML app with a tallit, a boy symbolizing the soul, a Torah scroll, and a boy learning from a Hebrew book. Each image plays or pauses its own approved personal recording.

Public site: https://esemmelman.github.io/averyservice01/

## Record your blessing

Run `node server.cjs`, then open http://127.0.0.1:4173 in Chrome or Edge. Allow microphone access, record, stop, and review. Choose **It’s good — use this recording** to save the audio, commit it, and push to GitHub automatically. This publishes your voice publicly. The recorder disappears after successful approval. GitHub Pages redeploys automatically after every push.

Each recorder is available only through the local server, before its recording has been approved. The new recordings are saved separately under recordings/; the original tallit recording stays in blessing.json and blessing.wav. Public visitors see only the tallit player. To replace a recording later, remove its JSON configuration locally (blessing.json for the tallit, or recordings/neshama.json, recordings/torah.json, or recordings/learning.json) and reload the local studio. Git and GitHub authentication are required for automatic publishing. No credentials are sent to the browser or stored in this project.

## Deploy

Enable GitHub Pages with GitHub Actions as its source. The workflow publishes only the HTML, JavaScript, and approved audio. No dependencies or build step are needed.

## Checks

Run `node --test recorder.test.cjs` to check separate recording, WAV preview, approval, and existing tallit preservation.

