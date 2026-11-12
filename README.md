# @schedule-x/drag-and-drop 3.7.3 on @schedule-x/calendar 4.9.1

`node repro.mjs` installs the packages, bundles `main.js` with esbuild, opens `index.html` in Chromium and drags the
week view's event 60 px down with the mouse. It exits 1 while the drag throws `startTimeGridDrag is not a function`,
0 once the drag moves the event.

By hand: `npm install`, `npx esbuild main.js --bundle --format=esm --outfile=bundle.js`, serve the folder
(`npx serve .`), open it and drag the event.
