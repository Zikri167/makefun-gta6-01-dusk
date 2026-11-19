# Verde Heat — Costa Verde

An open-world crime game in the spirit of GTA 6, built from scratch with three.js. $1,666 prize pool, 100 prize places.

Rico Vega just got out. Fixer Mara Voss has four jobs for him in the sun-soaked coastal city of Costa Verde — a fare, a hot car, a harbor run, and one last sundown drop. Finish them all and the city is his.

## The city

Costa Verde is a full 3D open world: Downtown towers, the Hills villas to the north, the Harbor docks and cranes to the east, the Marina promenade and beach to the south, and Market Square at its heart. Avenues and streets form a real grid, with traffic, pedestrians, street lamps, palms, and a living sea.

## Play

- **On foot:** WASD to move, Shift to run, mouse to look.
- **Driving:** walk up to any car and press **E** to get in (parked cars are there for the taking — the law notices). WASD to drive, **Space** for the handbrake, **E** to step out.
- **Combat:** click to fire the pistol, **R** to reload.
- **Doors:** glowing portals lead into the Voss office and the chop garage. Press **E** to enter, **E** again to leave. Inside, the heat cools off.
- **Pause:** **P**. **M** mutes the synthesized sound.

## Systems

- **Wanted level 0–5:** stealing cars, hitting or shooting pedestrians, and shooting cops raise the heat. Police spawn, chase, and ram; hide or stay sheltered to cool down. Get caught on foot and you're **Busted**; hit 0 HP and you're **Wasted**.
- **Missions:** four chained jobs with beacons, timers, and payouts — $150, $300, $500, $500. The finale runs at dusk.
- **HUD:** cash, HP, wanted stars, objective with live distance, speed, ammo, and a live 2D minimap.
- **Save:** progress is kept in localStorage between sessions.
- **Sound:** fully synthesized WebAudio — engine hum, sirens, gunshots, jingles, doors. No audio files.

## Tech

Static files under `game/`, no build step, no network at runtime. three.js is vendored under `game/vendor/three/`. Serve with `node serve.ts` and open http://localhost:8080.
