# The Tallit Blessing

A responsive HTML app with an original SVG tallit illustration. Click the tallit to play or pause the approved personal blessing.

Public site: https://esemmelman.github.io/tallit-blessing/

## Record your blessing

Run `node server.cjs`, then open http://127.0.0.1:4173 in Chrome or Edge. Allow microphone access, record, stop, and review. Choose **It’s good — use this recording** to save the audio, commit it, and push to GitHub automatically. This publishes your voice publicly. The recorder disappears after successful approval. GitHub Pages redeploys automatically after every push.

The recorder is available only through the local server, before a recording has been approved. Public visitors see only the tallit player. To replace a recording later, remove blessing.json locally and reload the local studio. Git and GitHub authentication are required for automatic publishing. No credentials are sent to the browser or stored in this project.

## Deploy

Enable GitHub Pages with GitHub Actions as its source. The workflow publishes only the HTML, JavaScript, and approved audio. No dependencies or build step are needed.
