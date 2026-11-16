# Clay — design direction

*Mold what you make.*

Clay is where you shape an app and the parts around it (its logo, its icon) by touching them. You mark up what you see, an agent molds it, and every version stays on the shelf so you can turn back to any of them. The design should feel like a quiet ceramics studio: warm surfaces, soft weight, honest materials, and one bright glaze for the thing you are working on. It should never feel like a code tool.

Prototype: [docs/prototype/index.html](prototype/index.html) (open in a desktop browser; it renders at iPhone 15/16 size, 393 × 852).
Code: tokens in [src/theme.ts](../src/theme.ts), primitives in [src/ui/](../src/ui/index.ts).

---

## 1. Principles

1. **The part is the interface.** Whatever you are shaping (the live app, the logo) takes the most room on every screen. Chrome sits in small floating pebbles around it and gets out of the way.
2. **Soft weight.** Things squash a little when pressed and settle with a small overshoot, like a thumb pressing into clay. Nothing snaps instantly; nothing bounces for show.
3. **One glaze.** The interface is warm neutrals plus one terracotta accent. Terracotta always means "this is what's live / selected / about to change". If two things are terracotta on a screen, one of them is wrong.
4. **Time is a material.** Versions are not a list in a settings page. They are a physical dial you turn, and the part changes in your hands as you turn it.
5. **Plain words.** Part, version, go back, mark up, mold it. Never component, element, commit, revert, deploy, DOM, prompt.

---

## 2. Palette

Warm, low-saturation neutrals named after the studio, one accent, and three glaze colors for markup.

| Token (`colors.*`) | Hex | Name | Use |
|---|---|---|---|
| `canvas` | `#F3EEE6` | Bisque | App background |
| `surface` | `#FFFDF9` | Slip | Raised slabs: cards, sheets, buttons |
| `well` | `#E9E2D7` | Well | Pressed-in areas: previews, inputs, segmented track |
| `ink` | `#1E1A16` | Kiln | Primary text, primary buttons |
| `inkSoft` | `#5B534B` | Umber | Secondary text |
| `muted` | `#9A9086` | Ash | Tertiary text, inactive icons |
| `line` | `rgba(30,26,22,0.09)` | — | Hairlines |
| `accent` | `#C65A35` | Terracotta | Live / selected / current, the needle, "Mold it" |
| `accentSoft` | `#F5E2D7` | Terracotta wash | Selected chip background |
| `onAccent` / `onInk` | `#FFF8F2` | — | Text on terracotta or kiln |
| `success` | `#3E8E6C` | Celadon | A new version landed |
| `warning` | `#C98A1E` | Ochre | Agent is working, key expiring |
| `danger` | `#C2412F` | Oxide | Delete, broken key |

**Night (the history stage only).** The scrubber is a dark room so the part glows: `night.bg #15120F`, `night.surface #221D18`, `night.ink #F6EFE6`, `night.muted #8C8277`, `night.line rgba(246,239,230,0.12)`. The needle stays terracotta.

**Glazes** (`glazes`) tint workspace pebbles and part wells so workspaces are recognisable at a glance without competing with the accent: Celadon `#DCE8DF`, Cobalt `#DCE2F4`, Ochre `#F3E4C6`, Rose `#F2DCD5`, Ash `#E5E0D9`, Lilac `#E6DFEE`.

**Markup** (`marks`): Change = Cobalt `#3457D5`, Broken = Oxide `#E0483A`, Keep = Celadon `#2E9A72`. These replace the violet/red/green set in Annotator.tsx and are chosen to read on both light app screenshots and the night stage. A note uses `ink` on a `surface` pebble.

Dark mode for the whole app is out of scope for v1 (`userInterfaceStyle: light`); only the history stage is dark, on purpose.

---

## 3. Type

Two families already bundled, used with discipline:

- **Instrument Serif** (display): workspace names, screen titles, the big version number on the history stage, empty-state titles. Never below 22 pt, never bold, never in buttons.
- **Inter** (UI): everything you read in passing and everything you tap.
- Version numbers and key fragments use Inter with `fontVariant: ["tabular-nums"]` so the scrubber label doesn't jitter.

| Style (`type.*`) | Font | Size / line | Use |
|---|---|---|---|
| `hero` | Serif | 44 / 46, −0.6 | "Clay" wordmark, history version number |
| `title` | Serif | 32 / 36, −0.3 | Screen titles, workspace name on its own screen |
| `heading` | Serif | 24 / 28 | Card titles, sheet titles, empty-state title |
| `body` | Inter 400 | 16 / 22 | Paragraphs, inputs |
| `label` | Inter 600 | 15 / 20 | Buttons, list titles |
| `callout` | Inter 500 | 14 / 19 | Secondary lines, chip text |
| `caption` | Inter 500 | 12 / 16 | Timestamps, meta |
| `eyebrow` | Inter 600 | 12 / 16, +0.9, uppercase | Section labels ("Parts", "Keys") |

---

## 4. Shape language: slabs, wells, pebbles

Every surface is one of three things, and you can tell which by looking:

- **Slab** (raised): `surface` fill, continuous corners (`borderCurve: "continuous"`), a soft warm shadow (`shadow.slab`) and a 1 px top highlight. Cards, sheets, secondary buttons.
- **Well** (pressed in): `well` fill, no shadow, a hairline inner border. Previews sit in wells, as do inputs and the segmented track. A well says "something goes here" or "this holds the work".
- **Pebble**: a small fully rounded slab (pill or circle) that floats over the part: icon buttons, tool docks, the version chip. Pebbles carry `shadow.pebble`.

Radii (`radius.*`): `xs 8`, `sm 12`, `md 18`, `lg 24`, `xl 32`, `pill 999`. Always continuous corners. Cards are `lg`, workspace cards `xl`, sheets `xl` on the top edge, inputs `md`.

Spacing (`space.*`) is a 4 pt grid: `1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40`. Screen gutters are 20.

**Selection** is a "glaze ring": a 2 pt terracotta outline drawn 3 pt outside the thing (`selectedRing` in theme). Never a fill change alone.

Icons: SF Symbols through `expo-symbols`, weight `semibold` at 15–17 pt in pebbles, `medium` elsewhere. No emoji in chrome; emoji belong to the user (workspace pebbles).

---

## 5. Motion

Clay physics: weighty, short, a single small overshoot. All springs live in `motion` in theme.ts.

| Moment | Motion | Token |
|---|---|---|
| Press anything tappable | Squash to scaleX 1.02 / scaleY 0.95 in 70 ms, spring back with a little overshoot | `motion.squash`, `motion.settle` |
| Screen content enters | Rise 12 pt + fade, staggered 60 ms per item, max 6 items | `motion.rise` |
| Sheet in / out | Spring up from bottom; drag down past 120 pt or flick to dismiss | `motion.sheet` |
| Segmented thumb | Slides as a pebble, slight stretch while moving | `motion.settle` |
| Agent working | **Kneading**: a pebble that squashes and stretches on a 1.6 s loop | `Kneading` |
| New version lands | Part does a 0.97 → 1 "set" spring, version chip counts up | `motion.settle` |
| Scrubber | Free momentum, decelerates, snaps to the nearest version | `Ruler` |

With Reduce Motion on (`useReducedMotion()`), squash, rise and kneading become opacity fades and the ruler snaps without momentum.

## 6. Haptics

Haptics mark *material events*, not every tap. The map lives in `src/ui/feel.ts` so screens never call expo-haptics directly.

| Event | Haptic | Call |
|---|---|---|
| Tap a button or pebble | Impact light | `feel.tap()` |
| Open a card / part | Impact soft | `feel.press()` |
| Ruler passes a version | Selection tick | `feel.tick()` |
| Ruler settles on a version you marked up | Impact rigid | `feel.land()` |
| Finish a mark (stroke ends) | Impact soft | `feel.press()` |
| "Mold it" sent, "Go back" confirmed | Impact medium | `feel.commit()` |
| A new version lands | Notification success | `feel.success()` |
| Something failed (bad key, agent error) | Notification error | `feel.error()` |

---

## 7. Signature interactions

### 7.1 The Wheel (history scrubber)

The showpiece. Open it from the version pebble on any part ("v14 ▾") or by pulling down on the part.

- **Stage.** Full screen, night palette. The part sits large in the middle on a soft spotlight. Above it: the big serif version number ("14") with "2 hours ago · Made the header warmer" under it in muted text.
- **The wheel.** Along the bottom, a ruler seen like the edge of a potter's wheel: one major tick per version, three minor ticks between, and ticks shrink and fade toward the edges so the strip reads as a curved surface turning under your thumb. A fixed terracotta needle marks the center. Day boundaries get a taller tick and a small date ("Tue").
- **Turn it.** Drag or flick. It has momentum and friction, and settles exactly on a version. Every version that passes the needle gives a selection tick; landing on a version that has your marks gives a firmer tap.
- **Watch it change.** Between two versions the stage cross-fades proportionally to where the needle is (onion skin), so dragging slowly *shows the change happening*. Versions you marked up show a small thumbprint dot above their tick; the marks appear faintly over the part when you rest there.
- **Play.** A play pebble runs a time-lapse from v1 to now at ~4 versions/second with ticks. Tap anywhere to stop.
- **Act.** Two pebbles at the bottom: **Mark up** (opens markup on that exact version) and **Go back to this** (hidden on the current version). Go back confirms with a sheet: "Go back to version 9? Codex will bring Fern back to how it was. Your later versions stay in history." Going back creates a new version; nothing is ever lost, and the copy says so.

### 7.2 Thumbprint markup

Markup should feel like pressing into the part, not opening a drawing app.

- **Enter.** Press and hold anywhere on a part (or tap the pen pebble). A thumbprint ripple spreads from the finger, the part sinks slightly (scale 0.97) into a well, and the tool dock rises. That sink is the cue that the part is now soft.
- **Dock.** One floating pebble with four tools (Draw, Circle, Arrow, Note) and a three-way tag segmented control (Change / Broken / Keep) above it. The tag color is the stroke color.
- **Strokes** draw with a slightly wobbly, tapered line (pressure-free but variable width by speed), so marks look hand-made.
- **Send.** The primary button is **Mold it**, with the agent named underneath ("Codex will change the app" / "Claude will redraw the logo"). After sending, the button becomes the Kneading pebble with live status ("Reading your marks…", "Shaping…", "Almost set"), and the part stays on screen.
- **Context.** Under the note field, chips show which other parts the agent will look at ("Uses Logo", "Uses Icon"). Tapping a chip toggles it. This is how "the logo appears in the header" becomes visible without jargon.

---

## 8. Screens (specs for DRAW-3)

Each screen lists structure and the primitives it uses. Structural changes from today's screens are marked **Change**.

### 8.1 Home — workspaces
- Header: `Clay` wordmark (`type.hero`) left, avatar pebble right (opens Settings). Under it a one-line serif lede in `inkSoft`: "Mold what you make."
- **Change:** workspaces replace the "designs by kind / connected apps" split. One vertical list of `Card` slabs (`radius.xl`). Each card: a `well` preview area showing the app part in a phone silhouette, with the workspace's other parts as small overlapping pebbles at the bottom-left of the well (like stones stacked against it). Footer: emoji `Pebble` (glaze tinted), name in serif, meta "3 parts · v14 · 2h ago", and a `Kneading` dot + "Molding…" chip if an agent is working.
- Primary action: a floating "New workspace" `Button` (ink, pill) bottom center above the safe area.
- Empty: `EmptyState` "Start a workspace" / "A workspace is one app and the parts that go with it, like its logo." / action "New workspace".

### 8.2 Workspace overview — its parts
- Top: back pebble, emoji `Pebble` + name (`type.title`), a key `Chip` ("OpenAI · Personal") that opens the key picker sheet, overflow pebble.
- Parts: the app part as a full-width card (live preview in a well), then design parts in a two-column grid of square cards. Each card: preview, name, "v9 · 1d ago", status chip when molding. A dashed well tile "Add a part" ends the grid.
- **Change:** relationships shown as small chips on a part card: "In App header" on the logo. Long-press a part to edit its relationships in a `Sheet`.
- Each card's version text is tappable and opens the Wheel for that part.

### 8.3 Part
- The part fills the screen in a well (app: live web view; logo: canvas on a checkerboard-free warm well).
- Floating top row: back pebble, part name pebble, version pebble "v14 ▾" (opens the Wheel).
- Floating bottom dock (pebble): Mark up, History, Ask (a text field that expands into the `Sheet`).
- Markup mode per 7.2. The dock becomes the tool dock + `Segmented` tags + note field + context chips + "Mold it" `Button` (accent).
- Design parts keep today's tap-to-select MakeSheet editing; restyle it with `Sheet`, `Segmented` (scope), `Swatches` (fill), `Chip` (suggestions).

### 8.4 History (the Wheel)
Per 7.1. Uses `Ruler` (night tone), `IconButton` (play, close), `Button` secondary night ("Mark up") and accent ("Go back to this"), `Sheet` for the go-back confirm. **Change:** replaces the Timeline.tsx modal list; the old list's per-version summary becomes the line under the version number, and the marks/after screenshots become the stage content.

### 8.5 Settings and keys
- Title "Settings". Sections: **Keys**, **Feel** (haptics on/off), **About**.
- Keys: one `Card` per key: provider glyph pebble (OpenAI / Anthropic), nickname, masked key "sk-…a9F2", "Used by 2 workspaces". Status chip: none when fine, Oxide "Not working" when the last call failed. Swipe or long-press → "Delete key" (danger `Button` in a confirm `Sheet` that lists the workspaces that will need a new key).
- "Add a key" opens a `Sheet`: provider `Segmented` (OpenAI / Anthropic), `Field` "Paste your key" (secure, monospaced), `Field` "Name it" (prefilled "Personal"), accent "Save key". Validation is inline under the field; keys are never shown again in full.

### 8.6 New workspace
A single scrolling sheet, not a wizard; every step has a sensible default so "Create" is enabled after the name.
1. Emoji `Pebble` (tap to change) + name `Field`. The pebble's glaze follows a `Swatches` row of the six glazes.
2. **Key**: radio `Card`s of saved keys, plus "Add a key".
3. **App**: `Segmented` "Connect my app" / "Start fresh" / "Later". Connect shows the two commands in a well with a copy pebble (`clay init`… keep `direct` until the CLI is renamed).
4. **Logo**: four template pebbles in a `Swatches`-style row (Sprout, Monogram, Pebble, None).
5. Accent "Create workspace" pinned at the bottom.

---

## 9. Primitive → screen map

| Primitive (`src/ui`) | Where |
|---|---|
| `Squish` | Base pressable for every tappable surface |
| `Button`, `IconButton` | All actions; pebbles on Part and History |
| `Card` (slab / well, pressable) | Workspace cards, part cards, key cards, radio cards |
| `Sheet` | Key picker, add key, go-back confirm, relationships, MakeSheet shell |
| `Chip` | Key chip, status, context ("Uses Logo"), suggestions |
| `Segmented` | Markup tags, scope (Just this / All like it / Everything), provider, app source |
| `Swatches` | Fill colors, glazes, logo templates |
| `Pebble` | Workspace emoji, provider glyph, part thumbnails in stacks |
| `Field` | Name, API key, note, ask |
| `Ruler` | History stage |
| `Kneading` | Agent working state anywhere |
| `EmptyState` | Home, parts, keys, history with one version |
| `feel` | All haptics |

## 10. Brand assets

- **Icon**: a terracotta field with a cream pebble pressed by a thumbprint (concentric offset arcs). Reads at 29 pt as "a soft stone", which is distinct from every pencil/brush/sparkle creative-AI icon.
- **Splash**: the pebble mark centered on Bisque `#F3EEE6`, configured through the `expo-splash-screen` plugin (the legacy top-level `splash` key is removed).
- **Name in app.json** changes to "Clay". The `slug`, `scheme` and bundle identifiers are left alone on purpose: changing them breaks existing installs and deep links and is a product decision for DRAW-3/Siena.
