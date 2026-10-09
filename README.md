# HUSH

A first-person escape horror game in the browser. Fifty procedurally generated rooms stand between you and the way out,
and the things that live in this house announce themselves by **sound** first. Listen, react, hide.

**Play:** https://ywchen0711.github.io/hush/ — desktop with headphones recommended (phones work with touch controls).

Built with [three.js](https://threejs.org/) (loaded from a CDN, pinned to 0.160.0). Every texture, model and sound is
generated in code — no asset files. Sounds are placed in 3D with HRTF panning, so you can hear which direction they come from.

## Controls

| | |
|---|---|
| WASD / mouse | move / look (click the screen to lock the mouse) |
| Shift | run (loud) |
| C | crouch (quiet) |
| E | open drawers and doors, hide in / leave wardrobes |
| F | flashlight (battery drains; find batteries in drawers) |

## The rooms

Each run builds a new house: ordinary rooms, long corridors, pitch-dark rooms, locked rooms (the key is in one of the drawers),
and every fifteenth room a huge **archive**. Drawers hold gold, batteries and bandages. Reach door 50 to get out.

## The things in the house

| It sounds like | What to do |
|---|---|
| **The Stampede** — the lights flicker and a rumble grows louder | Get inside a wardrobe before it tears through the room. It breaks the lights it passes. |
| **The Echo** — the same rumble, but it turns around | Stay hidden until the rumble is gone for good. |
| **The Hisser** — "psst" somewhere in a dark room | Turn and look at it within a couple of seconds. |
| **The Gaze** — a low choir humming in the room | Don't look at the cluster of eyes; it drains you while you do. |
| **The Listener** — heavy footsteps and your own heartbeat in the archive | It's blind and follows noise. Crouch, never run, and find the key. |
| **The Breather** — breathing right behind you in a wardrobe | You stayed hidden too long when nothing was out there. Get out. |
| **Skitter** | Some drawers bite. |

Sound captions can be turned on from the title screen.

## Files

```
index.html       page, HUD and screens
style.css
js/main.js       renderer, player, interaction, lights, game flow
js/world.js      room generator, procedural textures, furniture, doors, colliders
js/monsters.js   the director and every creature
js/audio.js      3D sound synthesis (Web Audio)
```

Run locally with any static server, e.g. `python -m http.server 8000`, then open http://localhost:8000
(ES modules don't load from `file://`).
