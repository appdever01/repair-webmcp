# RE:PAIR Master Product and Delivery Plan

Last researched: September 2, 2026

Competition deadline: September 3, 2026 at 1:00 p.m. PDT, which is 9:00 p.m. WAT

Primary build: one public, static, client-side web application

## 1. Executive decision

Build RE:PAIR as a precise repair instrument, not a generic assistant interface.

The competition version has one fictional solar study lamp, one complete diagnostic graph, one exceptional 3D model, and one path from symptom to verified repair. The agent supplies system knowledge and structured reasoning. The person supplies observations, physical action, budget, and approval. Every important state change is visible in the same repair bench.

The product sentence is:

> RE:PAIR is a living 3D repair manual where your agent understands the machine and you bring the judgment, senses, and hands.

The three-minute proof is:

1. A lamp charges but dies after five minutes.
2. The agent opens the lamp into a semantic exploded view.
3. The app presents only safe, relevant checks.
4. The person supplies a simulated physical measurement.
5. A deterministic fault model narrows three hypotheses to one.
6. Repair, replace, and reuse are compared by cost, time, risk, and waste.
7. The agent stages a plan and compatible part.
8. The person approves and completes the physical work.
9. The lamp turns on and the provenance trail shows who did what.

This plan deliberately rejects breadth. One object with a complete, credible loop is stronger than a catalogue of unfinished objects.

## 2. Product contract

### 2.1 The problem

Repair information is usually fragmented across manuals, videos, forums, part listings, and unstructured advice. A person has the object but often lacks system knowledge. An agent can interpret knowledge but cannot see a loose wire, smell a burnt component, hold a probe, or decide whether a risky repair is worth doing.

RE:PAIR creates one shared, inspectable workspace for both sides.

### 2.2 The core loop

The canonical loop is:

`describe symptom -> inspect system -> perform safe check -> record observation -> rank faults -> compare outcomes -> stage plan -> human approval -> physical steps -> verify result`

Every feature must shorten, clarify, or make this loop safer. Anything else waits.

### 2.3 Product principles

1. The object is the interface. The 3D lamp is the central information surface.
2. Human authority is explicit. The agent cannot approve a plan, buy a part, or claim a physical step was completed.
3. Reasoning is inspectable. Diagnoses show evidence for and against, not magic confidence numbers.
4. State is shared. Agent actions visibly update the same view the person is using.
5. Safety beats completion. Any stop condition ends the guided path and explains why.
6. One action has one home. There are no duplicate controls, duplicate stores, or overlapping tools.
7. Motion explains change. It never decorates empty space.
8. The interface sounds like a repair manual written by a good technician, not a chatbot.

### 2.4 MVP success measures

The competition build succeeds when:

- A new visitor understands the product within 12 seconds.
- The full scripted repair can be completed in under three minutes.
- Every exposed WebMCP tool is useful, state-aware, schema-valid, and visible in the interface.
- A person can complete the whole demo manually without WebMCP.
- The diagnostic result is deterministic for the same observations.
- The app remains useful without WebGL through its semantic text view.
- The main repair path works at desktop, mobile, keyboard-only, reduced-motion, and 200 percent zoom layouts.
- The deployed URL loads without authentication, third-party API keys, or network data dependencies.

### 2.5 Non-goals for the competition build

- Photo diagnosis or computer vision
- A general repair chatbot
- Real manufacturer claims
- Real checkout or payment
- Real electrical instructions for a real product
- User accounts, teams, cloud sync, or a backend
- Multiple devices
- Community content ingestion
- AR placement
- An embedded LLM
- A CMS
- WebGPU-only rendering

## 3. Research findings that shape the build

### 3.1 WebMCP

WebMCP is explicitly intended for cooperative, visible, human-in-the-loop workflows rather than headless autonomy. That matches RE:PAIR at the product level, not merely at the integration level. The current ChatGPT in-app browser discovers imperative tools registered on the top-level page, but not declarative form tools or tools inside iframes. RE:PAIR must therefore register tools through `document.modelContext` in the main application document. Sources: [WebMCP goals and non-goals](https://github.com/webmachinelearning/webmcp#goals--non-goals), [OpenAI site tools documentation](https://learn.chatgpt.com/docs/webmcp).

Chrome recommends narrow, non-overlapping tools, state-aware registration, succinct schemas, accurate `readOnlyHint` and `untrustedContentHint` annotations, cancellation handling, and outputs short enough for agents to consume reliably. The current guidance suggests limits of 30 characters for names, 150 characters for parameter descriptions, 500 characters for tool descriptions, and 1,500 characters for an individual result. Sources: [WebMCP best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices), [WebMCP security](https://developer.chrome.com/docs/ai/webmcp/secure-tools), [imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api).

### 3.2 Rendering

React Three Fiber 9 pairs with React 19. Its on-demand rendering mode stops the render loop when the scene is still, which is important for battery life and thermals. Drei controls already invalidate on camera changes. Use WebGL as the reliable baseline and treat WebGPU as later progressive enhancement. Sources: [React Three Fiber installation](https://r3f.docs.pmnd.rs/getting-started/installation), [scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance).

Three.js `GLTFLoader` supports Meshopt, Draco, KTX2, and the material extensions needed for production assets. If a GLB enters the pipeline, preserve component node names and hierarchy. Aggressive glTF Transform optimization may merge the very nodes required for the exploded view, so inspect first and apply focused transforms. Sources: [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [glTF Transform CLI](https://github.com/donmccurdy/glTF-Transform), [node hierarchy caution](https://github.com/donmccurdy/glTF-Transform/discussions/1520).

Drei warns that environment presets depend on a CDN and are not intended as a production dependency. RE:PAIR will self-host its environment asset or use a generated studio environment. Source: [Drei Environment](https://github.com/pmndrs/drei/blob/master/docs/staging/environment.mdx).

### 3.3 Interaction and accessibility

Zod can emit JSON Schema from the same runtime schemas through `z.toJSONSchema()`. This prevents tool schemas, application validation, and test fixtures from drifting apart. Source: [Zod JSON Schema](https://zod.dev/json-schema).

Motion supports a global reduced-motion policy and a live `useReducedMotion` signal. RE:PAIR will use it for the DOM and share the same motion preference with the 3D scene. Source: [Motion reduced motion](https://motion.dev/docs/react-use-reduced-motion).

WCAG 2.2 adds requirements around unobscured focus, dragging alternatives, and minimum target size. The canvas will not be the only way to inspect or select a component. Source: [W3C WCAG 2.2 changes](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

### 3.4 Product and content ecosystem

Apple's current design principles stress purpose, agency, simplicity, hierarchy, craft, and iteration. Its material guidance also treats translucent material as a functional layer for controls, not a texture to smear across all content. RE:PAIR will follow those principles without cloning an Apple product. Sources: [Apple design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles), [Apple materials](https://developer.apple.com/design/human-interface-guidelines/materials).

The Open Repair Data Standard offers useful future mappings for product category, problem, repair status, repair barrier, session, and provenance, but it is an aggregate repair-event format rather than an interactive diagnostic graph. iFixit offers a rich API, but its public content is CC BY-NC-SA and carries commercial-use constraints. Neither source belongs in the MVP runtime. Sources: [Open Repair Data Standard](https://openrepair.org/open-data/open-standard/), [iFixit API v2](https://www.ifixit.com/api/2.0/doc/), [iFixit licensing](https://www.ifixit.com/Info/Licensing).

## 4. The competition product

### 4.1 Device dossier

The sole device is the fictional `Aurelia S1 Solar Study Lamp`.

| Property | Competition value |
| --- | --- |
| Product type | Portable solar study lamp |
| Body | Warm white polycarbonate shell with a graphite base |
| Power | Fictional 3.2 V LiFePO4 cell, USB-C and solar charging |
| Failure symptom | Charges normally, then switches off after five minutes |
| Primary diagnosis | Battery cell has high internal resistance |
| Repair part | Demonstration-only compatible battery module, $12.80 |
| Repair time | 20 minutes |
| Safety class | Guided simulation only, no live-device instruction |
| Final state | Restored light, verified runtime check |

The fictional name and clearly labeled simulation prevent the demo from masquerading as advice for a real electrical product.

### 4.2 Semantic component map

Every visible 3D assembly has one stable domain ID. The ID is shared by geometry, labels, checks, hypotheses, repair steps, focus targets, and the text alternative.

| ID | Component | Visual role | Diagnostic role |
| --- | --- | --- | --- |
| `shell.top` | Upper shell | Main silhouette | Access boundary |
| `solar.panel` | Solar panel | Dark glass surface | Charging input |
| `light.diffuser` | Diffuser ring | Translucent ring | Light output |
| `led.array` | LED board | Warm radial board | Load candidate |
| `hinge.arm` | Articulated arm | Mechanical spine | Cable route |
| `base.cover` | Base cover | Lower enclosure | First removable part |
| `fastener.base.1-4` | Four screws | Repeated detail | Safe opening sequence |
| `battery.pack` | Battery module | Soft blue wrap | Primary fault candidate |
| `charge.board` | Charge controller | Green PCB | Charging candidate |
| `usb.port` | USB-C port | External connector | Power input check |
| `main.switch` | Power switch | Human control | Runtime check |
| `wire.harness` | JST harness | Red and black pair | Polarity and continuity |

### 4.3 Fault graph

The fault engine is rules-based. It does not call an LLM and does not generate free-form technical claims.

Initial hypotheses:

| Hypothesis | Initial weight | Evidence that raises it | Evidence that lowers it |
| --- | ---: | --- | --- |
| `battery.high_resistance` | 35 | Very short runtime, voltage collapse under load, rebound after load | Stable voltage under load |
| `charge_controller.failure` | 35 | Missing charge voltage, no charge indicator, battery never reaches nominal range | Normal charge voltage and indicator |
| `led_board.overdraw` | 30 | Load current above reference, unusual LED heat, stable battery off-load | Normal current draw and sharp battery rebound |

Demo observations:

| Sequence | Human observation | Effect |
| --- | --- | --- |
| 1 | Charge indicator is steady green | Lowers controller-failure score |
| 2 | Battery reads 3.26 V with lamp off | Shows the cell accepts surface charge |
| 3 | Battery falls to 2.31 V under load | Strongly raises high-resistance score |
| 4 | Battery rebounds to 3.08 V after switch-off | Confirms voltage sag pattern |

The final result is `Likely cause: battery cell wear` with a plain evidence list. Do not display `98% confidence`. The system has rules, not a statistically calibrated probability model.

### 4.4 Repair options

| Option | Cost | Time | Risk | Waste | Result |
| --- | ---: | ---: | --- | ---: | --- |
| Replace battery module | $12.80 | 20 min | Low in simulation | 48 g | Restores portable use |
| Convert to wired lamp | $6.50 | 30 min | Medium | 40 g | Loses portable use |
| Replace whole lamp | $34.00 | 5 min | Low | 620 g | New device |

The interface defaults to no recommendation until enough evidence exists. Once the fault is narrowed, it marks battery replacement as `Best fit for your $20 limit`, not `Best choice`.

### 4.5 Repair steps

1. Disconnect charging power.
2. Turn the lamp off.
3. Rotate the lamp and remove the four base screws.
4. Lift the base cover without pulling the wire harness.
5. Inspect the battery for swelling or damage. If present, stop.
6. Disconnect the keyed battery connector.
7. Remove the old battery module.
8. Seat the staged replacement with the connector aligned.
9. Reconnect the harness.
10. Close the base and tighten screws in a cross pattern.
11. Run the simulated five-minute verification.

The person must mark each physical step complete. The agent can focus a step and explain it, but cannot claim it happened.

## 5. Experience architecture

### 5.1 One workspace, not a dashboard

The app opens directly on the repair bench. There is no marketing homepage in front of the demo.

Desktop composition:

- A 56 px top rail holds the wordmark, device name, stage, and a small `Tools ready` status.
- The 3D object occupies the visual center and at least 60 percent of the viewport area.
- A single 320 px context panel sits on the right. Its content changes with the repair stage.
- A 72 px provenance timeline runs along the bottom.
- A narrow component index can appear on the left only in inspect mode. It is not permanently visible.

This layout avoids the familiar generated-dashboard pattern of a sidebar plus a grid of interchangeable cards. The main object stays dominant.

### 5.2 Progressive stages

| Stage | Main visual | Context panel | Human action | Agent contribution |
| --- | --- | --- | --- | --- |
| Intake | Lamp intact and softly lit | Symptom and budget | Confirm symptom | Read bench state |
| Inspect | Lamp opens into exploded view | Component details | Rotate or select | Focus relevant systems |
| Check | Two candidates glow | Safe check instructions | Supply observation | List and interpret checks |
| Diagnose | Three traces converge | Ranked causes and evidence | Judge plausibility | Compute deterministic ranking |
| Compare | Lamp shifts left | Three outcome rows | Select priorities | Compare options |
| Stage | Replacement appears beside old cell | Part compatibility and plan | Review | Stage plan and part |
| Repair | One part at a time | Current step | Complete physical step | Focus and explain |
| Verify | Lamp reassembles | Verification timer | Confirm test | Summarize result |
| Restored | Warm light turns on | Repair receipt | Save or restart | Read final state |

### 5.3 First-load experience

First load has one compact instruction, positioned below the wordmark:

> This is a simulated repair. Ask your browser agent: “It charges but dies after five minutes. Help me fix it for under $20.”

Controls:

- `Copy prompt`
- `Explore manually`

No modal tour. No carousel. No confetti. No chat bubble.

### 5.4 Context panel behavior

The context panel is a single persistent container. Content changes in place, which preserves location and reduces visual noise.

Panel anatomy:

1. Eyebrow: current stage, such as `CHECK 02 OF 03`
2. Title: one direct sentence
3. Evidence or instruction body
4. One primary action and at most one secondary action
5. Persistent safety note only when relevant

Example copy:

- Good: `Battery voltage falls under load.`
- Good: `Measure across the battery terminals with the lamp on.`
- Good: `Stop if the cell is swollen, hot, or damaged.`
- Reject: `Let's dive into an intelligent diagnostic journey.`
- Reject: `AI-powered insights have detected a possible issue.`

### 5.5 Mobile and zoom layouts

At widths below 760 px:

- The 3D scene occupies the upper 52 to 58 viewport height.
- The context panel becomes a bottom sheet with three snap positions.
- The active action stays in the sheet, never over the 3D object.
- The timeline collapses to a provenance button with an unread count.
- Component selection has a text list directly below the canvas.
- Camera orbit is one-finger, page scroll begins outside the canvas, and every drag control has buttons as an alternative.

At 200 percent zoom:

- The app becomes a normal vertical document.
- The canvas has a minimum height of 320 px and does not trap focus.
- The context panel follows it in source order.
- No horizontal page scrolling is allowed at a 1280 px viewport.

### 5.6 Human and agent authority

| Action | Human UI | Agent tool | Rule |
| --- | --- | --- | --- |
| Read state | Yes | Yes | Always available |
| Inspect component | Yes | Yes | Read-only |
| Focus camera | Yes | Yes | Transient and visible |
| Record reported observation | Yes | Yes | Provenance required |
| Derive diagnosis | Yes | Yes | Deterministic read |
| Stage a repair plan | Yes | Yes | Reversible |
| Stage a part | Yes | Yes | No purchase |
| Approve repair plan | Yes | No | Human only |
| Complete physical step | Yes | No | Human only |
| Verify physical outcome | Yes | No | Human only |
| Purchase | No | No | Out of scope |

## 6. Visual design system

### 6.1 Art direction

The visual direction is `precision instrument on a quiet workbench`.

It combines:

- The calm hierarchy of a premium hardware setup screen
- The physical legibility of an exploded engineering drawing
- The warmth of a repair object that has history
- The restraint of a museum product display

It must not resemble a crypto dashboard, an AI landing page, a glassmorphism kit, or a reskinned component library.

### 6.2 Palette

| Token | Value | Use |
| --- | --- | --- |
| `ink` | `#0B0D0E` | Main background |
| `graphite` | `#171A1C` | Panel and object base |
| `steel` | `#2B3033` | Hairlines and inactive controls |
| `paper` | `#F2F0E9` | Primary text and warm shell |
| `mist` | `#AAAFAE` | Secondary text |
| `signal` | `#C8FF4A` | Active focus and successful continuity |
| `charge` | `#80A7FF` | Electrical observation |
| `warning` | `#FFB44A` | Caution |
| `fault` | `#FF6A5F` | Stop condition and failed check |

Rules:

- `signal` covers less than 5 percent of the interface.
- Status never relies on color alone.
- Gradients are forbidden in the DOM UI.
- The only glow comes from the lamp, active 3D component, or electrical trace.
- Pure white is avoided so the object and text feel integrated.

### 6.3 Typography

Use a system font stack first for speed and native clarity:

`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

Typography relies on weight, width, spacing, and alignment rather than a trendy display font.

| Role | Size | Weight | Notes |
| --- | ---: | ---: | --- |
| Product title | clamp 30 to 54 px | 560 | Tight tracking, two lines maximum |
| Panel title | 24 px | 560 | Sentence case |
| Body | 15 px | 430 | 1.55 line height |
| Label | 11 px | 620 | Uppercase, 0.10 em tracking |
| Measurement | 20 px | 520 | Tabular numerals |
| Button | 14 px | 560 | Sentence case, direct verb |

Do not use giant 80 px headlines, gradient text, or monospace for every technical label.

### 6.4 Shape and spacing

- Base spacing unit: 4 px
- Main gaps: 12, 16, 24, 32 px
- Control height: 44 px
- Button radius: 10 px
- Main context surface radius: 18 px
- Small tag radius: 999 px only when the element is truly a status capsule
- Border: 1 px with low-contrast steel
- Shadow: one soft elevation shadow for the context panel, none for ordinary rows

Cards are not the default layout unit. Evidence, options, and steps use aligned rows separated by hairlines.

### 6.5 Materials

The canvas sits directly on the `ink` background. The context panel uses a nearly opaque graphite surface. A small amount of backdrop blur may support the panel only if text contrast remains stable. The content layer stays solid.

No frosted glass on every control. No glowing borders. No decorative noise texture. No animated grain.

### 6.6 Iconography

Create a tiny project-specific SVG set with a 20 px grid, 1.5 px stroke, round joins, and optical correction. Required icons only:

- Inspect
- Isolate power
- Measure
- Compare
- Repair
- Reuse
- History
- Undo
- Warning
- Check

Do not install a 1,000-icon library for ten icons. Text remains on every consequential control.

### 6.7 Motion language

Motion has four durations:

| Token | Duration | Use |
| --- | ---: | --- |
| `instant` | 100 ms | Hover, focus, state tint |
| `quick` | 180 ms | Row and control transitions |
| `move` | 320 ms | Panel content and camera reframing |
| `explain` | 680 ms | Exploded view and reassembly |

Rules:

- Structural motion uses a critically damped spring with no visible bounce.
- Opacity starts after spatial motion begins and finishes before it settles.
- Camera motion follows the shortest safe arc and never spins for spectacle.
- The exploded view moves parts along mechanically believable axes.
- The interface never animates while waiting only to look busy.
- Reduced-motion mode replaces travel with crossfade and immediate camera cuts.
- Continuous rotation is forbidden.

### 6.8 Anti-slop review

Reject the build if it contains any of the following:

- A purple-blue gradient background
- A floating orb, sparkles, or meaningless particle field
- An oversized generic hero before the product
- A permanent dashboard sidebar
- A grid of identical rounded cards
- Icons without labels on important actions
- Decorative metrics with no product meaning
- Copy such as `unlock`, `revolutionize`, `seamless`, `powered by AI`, or `journey`
- Multiple animation libraries
- Multiple state managers
- A chat interface inside the repair interface
- Placeholder stock imagery
- Component-library defaults left visually unchanged

## 7. Three.js and 3D production plan

### 7.1 Renderer choice

Use `three` through `@react-three/fiber` with a WebGL renderer. Configure:

- `ACESFilmicToneMapping`
- `SRGBColorSpace`
- Perspective camera at 34 degrees field of view
- Dynamic pixel ratio between 1 and 1.75
- `frameloop="demand"`
- Alpha canvas over the page background
- Antialiasing on capable devices
- Soft shadows only on the high-quality tier

WebGPU is a later experiment. It is not allowed to become a competition blocker.

### 7.2 Model strategy

Build the Aurelia S1 as a semantic, mostly procedural assembly in React Three Fiber.

Reasons:

- Stable component IDs are natural.
- Exploded positions are explicit and editable in code.
- Materials can react directly to diagnostic state.
- No Blender round trip is required for every spacing change.
- The final style can be intentionally product-rendered rather than fake photorealism.

Use geometry primitives, lathed profiles, beveled extrusions, rounded boxes, tubes for wires, instanced screws, and carefully shared materials. The result should look manufactured, not like a stack of default cubes.

A single Blender-authored hero shell is acceptable only if the procedural silhouette fails the first visual review. If used, it must preserve named nodes and clean pivots.

### 7.3 Scene graph

The scene mirrors the domain model:

```text
AureliaLamp
  ShellAssembly
    TopShell
    SolarPanel
    Diffuser
    LedArray
  HingeAssembly
    HingeArm
    WireHarness
  BaseAssembly
    BaseCover
    Fasteners
    BatteryPack
    ChargeBoard
    UsbPort
    MainSwitch
```

Every component receives:

- `componentId`
- assembled transform
- exploded transform
- focus bounding box
- material role
- selectable flag
- current diagnostic status

### 7.4 Exploded-view choreography

The full reveal lasts 680 ms:

1. At 0 ms, the camera eases back 8 percent.
2. At 60 ms, the base cover moves down.
3. At 120 ms, screws move along their axes as one instanced group.
4. At 180 ms, the battery and charge board separate laterally.
5. At 250 ms, the diffuser and LED array lift.
6. At 330 ms, the solar panel shifts upward and the wire route appears.
7. At 460 ms, labels fade in near their anchors.
8. At 680 ms, all motion settles and the render loop sleeps.

For reduced motion, the app crossfades from assembled to exploded positions in 140 ms with no camera travel.

### 7.5 Lighting and materials

Use a small studio rig:

- Large warm key light above-left
- Cool, low-intensity fill from the right
- Thin rim light behind the hinge
- Self-hosted neutral 512 px environment gain map, or a generated room environment
- Soft contact shadow under the base

Materials:

- Shell: warm rough polymer with subtle clearcoat
- Base: charcoal polymer with higher roughness
- Panel: dark blue glass, no mirror finish
- PCB: muted green with small instanced components
- Battery: desaturated blue sleeve
- Metal: restrained satin finish
- Diffuser: shallow transmission only on capable devices, opaque fallback otherwise

Do not use bloom as the main visual trick. If added after the performance gate, use selective bloom only for the powered LED and active signal trace.

### 7.6 Interaction

- Pointer hover adds a 1 px silhouette and changes the cursor.
- Click or Enter selects one component.
- Double-click never carries unique behavior.
- Orbit is limited to useful polar angles.
- Zoom has conservative minimum and maximum distances.
- A `Reset view` text button is always available.
- Agent camera focus and human camera focus use the same action and motion tokens.
- Labels are DOM overlays only while useful, not permanent clutter.

### 7.7 3D accessibility twin

The canvas is `aria-hidden="true"`. A synchronized DOM component tree appears in the same source order as the device hierarchy.

The twin provides:

- Component names and roles
- Current state such as `suspected`, `cleared`, or `fault likely`
- The same select and focus action
- Evidence and checks associated with each component
- Keyboard navigation with visible focus
- Live-region announcements after agent actions

The canvas is an enhancement. It is never the sole source of content or control.

### 7.8 Performance budgets

| Budget | Target | Stop-ship ceiling |
| --- | ---: | ---: |
| Initial shell JavaScript, gzip | under 150 KB | 200 KB |
| Deferred 3D JavaScript, gzip | under 450 KB | 600 KB |
| 3D and environment assets | under 1.5 MB | 2.5 MB |
| Triangle count | under 90,000 | 150,000 |
| Draw calls at rest | under 120 | 180 |
| Desktop animation | stable 60 fps | below 50 fps |
| Mid-range mobile animation | stable 30 fps | below 24 fps |
| Long task during interaction | under 100 ms | 200 ms |
| Idle GPU activity | zero frames | continuous loop |

Quality tiers:

- High: shadows, transmission, 1.75 DPR
- Standard: simpler diffuser, soft baked shadow, 1.25 DPR
- Safe: 1 DPR, no post-processing, opaque diffuser
- Fallback: static WebP render plus semantic component tree

### 7.9 Asset pipeline

For procedural assets:

1. Reuse geometries and materials.
2. Instance screws and repeated PCB parts.
3. Dispose generated resources on unmount.
4. Lazy-load the scene after the interface shell.
5. Capture a static fallback render during release preparation.

For any GLB:

1. Validate names, pivots, normals, UVs, and scale in meters.
2. Run `gltf-transform inspect`.
3. Apply deduplication, pruning, texture resize, and Meshopt only where they preserve the semantic node tree.
4. Reject automatic flatten or join operations that merge interactive parts.
5. Validate the final asset through `GLTFLoader` in the production scene.

## 8. Domain and data architecture

### 8.1 One source of truth

Use one vanilla Zustand store as the authoritative browser state. React subscribes through selectors. WebMCP tools call the same domain actions through the store API. No tool writes directly to React component state or the Three.js scene.

The store has four areas:

```text
repair
  session, symptom, budget, observations, stagedPlan, approval, stepProgress
derived
  safeChecks, rankedHypotheses, options, allowedActions
view
  mode, focusedComponentId, focusedStepId, cameraPreset, panelState
history
  stateVersion, activity, undoStack
```

Only serializable repair and history data is persisted. Camera state and animation progress are not.

### 8.2 State stages

`intake | inspect | check | diagnose | compare | staged | approved | repair | verify | restored | stopped`

The stage is derived from facts where possible. For example, a staged plan plus human approval yields `approved`. This prevents an impossible stage from being set independently.

### 8.3 Domain events

All durable changes pass through named events:

- `symptom_recorded`
- `budget_set`
- `observation_recorded`
- `plan_staged`
- `part_staged`
- `plan_approved`
- `physical_step_completed`
- `verification_recorded`
- `agent_action_undone`
- `session_reset`

Each event records:

- Unique ID
- Event type
- Actor: `human`, `agent`, or `system`
- Origin: `ui`, `webmcp`, or `derived`
- Timestamp
- Previous state version
- Resulting state version
- Small before and after payload

Derived diagnoses do not pretend to be human or agent actions. They are system derivations tied to the observations that caused them.

### 8.4 Repair graph format

Create `repair-graph.json` as an original, versioned, open format with these sections:

```text
schemaVersion
device
components[]
symptomPresets[]
safetyRules[]
checks[]
observationDefinitions[]
hypotheses[]
diagnosticRules[]
repairOptions[]
parts[]
planTemplates[]
verificationRules[]
ordsMapping
```

Important fields:

- `components[].id` is globally stable inside a device definition.
- `checks[].requires` and `checks[].stopConditions` gate safety.
- `diagnosticRules[].when` uses a small declared operator set, never evaluated JavaScript.
- `hypotheses[].evidenceFor` and `evidenceAgainst` remain human-readable.
- `parts[].compatibility` lists voltage, connector, polarity, size, and chemistry.
- `planTemplates[].steps` reference component IDs and safety rule IDs.
- `ordsMapping` makes future export possible without claiming ORDS compliance.

Zod is the schema source. Build output includes a generated JSON Schema and one validated example graph.

### 8.5 Deterministic diagnosis

The engine accepts a graph and observations and returns:

- Ranked hypotheses
- Evidence for and against each hypothesis
- Missing discriminating checks
- Any safety stop
- Stable explanation codes

Rules are pure functions. No current time, random values, network calls, or UI state enters the diagnosis. A snapshot test proves the canonical observation sequence every time.

### 8.6 Persistence and reset

- Persist to `localStorage` under a versioned key.
- Store schema version and run explicit migrations.
- Reset has a clear confirmation and removes only the RE:PAIR session key.
- Add a `Demo reset` control in the visible overflow menu, not as a hidden keyboard shortcut.
- Do not add service-worker caching before submission. A stale competition build is a larger risk than offline support.

## 9. WebMCP tool strategy

### 9.1 Tool set

All names stay below Chrome's current 30-character guidance.

| Tool | Stage | Annotation | Essential input | Effect |
| --- | --- | --- | --- | --- |
| `get_bench_state` | All | Read-only | Optional detail level | Returns compact current state and allowed actions |
| `set_repair_goal` | Intake | Write | Symptom preset, maximum budget, currency, expected version | Records the repair constraint without accepting free-form instructions |
| `inspect_component` | Inspect onward | Read-only | Component ID | Returns purpose, state, evidence, and related checks |
| `focus_component` | Inspect onward | Write, transient | Component ID, expected version | Focuses camera and context panel visibly |
| `list_safe_checks` | Check and diagnose | Read-only | Optional component ID | Returns currently allowed checks and stop conditions |
| `record_observation` | Check and diagnose | Write | Check ID, value, source, expected version | Adds a reported observation with provenance |
| `diagnose_faults` | Diagnose onward | Read-only | None | Returns ranked deterministic hypotheses and missing evidence |
| `compare_repair_options` | Compare onward | Read-only | Optional priority | Uses the stored budget and returns repair, reuse, and replace comparison |
| `stage_repair_plan` | Compare | Write | Option ID, expected version | Creates a reversible plan for human review |
| `focus_repair_step` | Staged onward | Write, transient | Step ID, expected version | Focuses the corresponding component and instruction |
| `stage_part_cart` | Staged onward | Write | Part ID, quantity, expected version | Stages a compatible part without purchasing |
| `undo_agent_action` | After agent write | Write | Activity ID, expected version | Reverses the latest eligible agent change |

There is no `approve_plan`, `complete_step`, `verify_repair`, or `purchase_part` tool.

### 9.2 Registration lifecycle

- Register all generally useful read tools once the app hydrates.
- Register stage-specific write tools only when their preconditions hold.
- Use one `AbortController` per registration group.
- Remove tools when they are no longer valid for the state.
- Handle missing `document.modelContext` without errors or degraded human UI.
- Keep registration in one top-level module, never inside the canvas or an iframe.
- Log registration failures locally in development, not to a production analytics service.

### 9.3 Schema discipline

- Define every input in Zod.
- Emit Draft 7 JSON Schema for WebMCP compatibility.
- Set `additionalProperties: false`.
- Use enums for component, check, option, part, and step IDs.
- Represent the symptom as a known preset ID. Do not accept a free-form tool instruction as domain content.
- Put bounds and units on numbers.
- Reject NaN, infinity, blank strings, unknown IDs, and impossible stage calls.
- Keep parameter descriptions under 150 characters.
- Use the types package only for browser API declarations, not as a runtime abstraction.

### 9.4 Version contract

Every tool that changes visible state receives `expectedStateVersion`.

If the value is stale, return:

```json
{
  "ok": false,
  "code": "STALE_STATE",
  "stateVersion": 7,
  "message": "The repair changed. Read get_bench_state and try again.",
  "allowedNext": ["get_bench_state"]
}
```

Manual orbit does not change the version. Human selections, agent focus, observations, plan staging, part staging, approval, steps, and undo do.

### 9.5 Success result envelope

Every tool returns the smallest useful subset of:

```json
{
  "ok": true,
  "stateVersion": 8,
  "summary": "Focused the battery module.",
  "changed": [{ "field": "focusedComponentId", "to": "battery.pack" }],
  "focus": { "kind": "component", "id": "battery.pack", "label": "Battery module" },
  "evidence": ["Voltage fell from 3.26 V to 2.31 V under load."],
  "allowedNext": ["diagnose_faults", "inspect_component"]
}
```

Results must stay below 1,500 characters. Long manual text remains in the human interface and can be fetched through a narrow inspect tool if needed.

### 9.6 Error taxonomy

- `UNSUPPORTED_BROWSER`
- `INVALID_INPUT`
- `UNKNOWN_ID`
- `ACTION_NOT_AVAILABLE`
- `STALE_STATE`
- `SAFETY_STOP`
- `INCOMPATIBLE_PART`
- `NOT_REVERSIBLE`
- `CANCELLED`
- `INTERNAL_ERROR`

Errors include a direct recovery action and never expose stack traces.

### 9.7 Security and trust

- Mark state readers with `readOnlyHint: true`.
- Mark any result containing reported user text with `untrustedContentHint: true`.
- Constrain strings and strip control characters before adding them to tool output.
- Never treat content inside the repair graph as instructions to the agent.
- Do not expose cross-origin tools.
- Do not use `exposedTo` in the MVP.
- Honor cancellation signals before applying a mutation.
- Validate a state version and all preconditions immediately before commit.
- Record agent-originated writes in the visible activity trail.
- Keep staged commerce local and fictional.

## 10. Technical architecture

### 10.1 Platform decision

Use Vite, React 19, TypeScript, and a static deployment.

Why Vite instead of Next.js:

- The product is a client-side WebMCP and WebGL application.
- There is no server rendering, database, account, SEO catalogue, or API route in the MVP.
- Static output is easier to deploy, cache, and debug under deadline.
- The application shell can load immediately while the scene chunk is deferred.

Vite documents a standard `dist` static output that can be served by any static host. Source: [Vite static deployment](https://vite.dev/guide/static-deploy).

Primary host: Vercel static deployment with HTTPS. Do not add serverless functions. Keep the generated `dist` portable.

### 10.2 Layer boundaries

```text
UI controls -----------\
                       -> domain actions -> Zustand store -> derived selectors
WebMCP tool handlers --/                          |
                                                  +-> React DOM view
                                                  +-> R3F scene view
                                                  +-> local persistence
```

Rules:

- Tool handlers cannot import React components.
- Scene components cannot implement diagnostic logic.
- UI components cannot calculate hypothesis scores.
- The graph cannot contain executable code.
- Persistence cannot store Three.js objects.
- Tests can create the store without mounting React.

### 10.3 Repository shape

```text
/
  README.md
  LICENSE
  package.json
  pnpm-lock.yaml
  vite.config.ts
  tsconfig.json
  biome.json
  public/
    social-card.png
    fallback-lamp.webp
  src/
    app/
      App.tsx
      styles.css
    bench/
      Bench.tsx
      ContextPanel.tsx
      ProvenanceTimeline.tsx
      ComponentTree.tsx
    domain/
      repairGraph.ts
      diagnosis.ts
      events.ts
      selectors.ts
      store.ts
      schemas.ts
    scene/
      RepairScene.tsx
      AureliaLamp.tsx
      camera.ts
      materials.ts
      motion.ts
      quality.ts
    webmcp/
      registerTools.ts
      toolDefinitions.ts
      toolResults.ts
    content/
      aurelia-s1.repair-graph.json
    design/
      tokens.css
      icons/
    test/
      fixtures.ts
      modelContextMock.ts
    main.tsx
  tests/
    domain/
    webmcp/
    ui/
    e2e/
  evals/
    prompts.json
    expected-traces.json
  docs/
    repair-graph.schema.json
    demo-script.md
    submission-copy.md
```

Do not create a generic `components/ui` directory. Components live with the product surface they serve.

### 10.4 Required packages

Pin exact compatible versions in the lockfile after the first smoke test. Do not add packages speculatively.

| Package | Role | Why it earns a dependency |
| --- | --- | --- |
| `react`, `react-dom` | UI runtime | Shared DOM application model |
| `three` | 3D engine | Rendering, geometry, materials, picking, math |
| `@react-three/fiber` | React renderer for Three.js | Keeps scene state aligned with product state |
| `@react-three/drei` | Focused 3D helpers | Bounds, controls, environment, and text helpers only |
| `zustand` | State | Vanilla store usable by UI, tools, and tests |
| `zod` | Validation and JSON Schema | One contract for runtime, WebMCP, data, and fixtures |
| `motion` | DOM motion | Accessible panel and control transitions |

Development packages:

| Package | Role |
| --- | --- |
| `vite`, `@vitejs/plugin-react` | Build and development server |
| `typescript` | Static contracts |
| `@types/react`, `@types/react-dom`, `@types/three` | Type declarations |
| `webmcp-types` | Draft browser API types recommended by Chrome documentation |
| `vitest`, `@vitest/coverage-v8`, `jsdom` | Unit and component test runtime |
| `@testing-library/react`, `@testing-library/user-event` | Behavior-level UI tests |
| `playwright`, `@axe-core/playwright` | Focused end-to-end and accessibility smoke tests |
| `@biomejs/biome` | One formatter and linter instead of two toolchains |
| `rollup-plugin-visualizer` | Release-only bundle inspection |

### 10.5 Conditional packages

Add only after a measured need:

| Package | Admission test |
| --- | --- |
| `@react-three/postprocessing` | Selective LED bloom clearly improves the restored moment and stays inside budgets |
| `@gltf-transform/cli` | A Blender-authored GLB enters the final product |
| `meshoptimizer` | The final GLB is large enough that measured transfer improvement justifies a decoder |

### 10.6 Explicitly rejected packages

| Rejected choice | Reason |
| --- | --- |
| Next.js | No server requirement and more framework surface under deadline |
| Tailwind CSS | Custom tokens and product CSS are smaller and harder to make look templated |
| shadcn/ui | Its default composition is too recognizable for this visual target |
| GSAP | Motion plus Three.js interpolation already covers the required choreography |
| React Spring | A second animation system would split timing and reduced-motion logic |
| XState | The flow is small enough for explicit domain events and derived stages |
| Redux Toolkit | More state machinery than this local product needs |
| TanStack Query | There is no remote server state |
| React Router | The MVP is one workspace with no route graph |
| Form libraries | The few inputs are narrow and schema-backed |
| Icon libraries | Ten custom symbols are more coherent and cheaper |
| Spline | The model must share domain IDs and deterministic state with the app |
| Lottie | No canned decorative animation belongs in the product |
| `@react-three/a11y` | The full synchronized DOM twin is the accessibility source of truth |

### 10.7 Coding rules

- TypeScript strict mode.
- No `any` in domain, tool, or state code.
- No source comments unless explicitly requested.
- No barrel files that hide feature ownership.
- No utility abstraction before the third real use.
- No component over 250 lines without a clear composition review.
- No state mutation outside named domain actions.
- No package with a duplicated responsibility.
- No ignored promise from tool registration or persistence.
- No copy generated at runtime.

## 11. Quality and verification plan

### 11.1 Test pyramid

| Layer | Proves | Key cases |
| --- | --- | --- |
| Domain unit | Diagnosis is deterministic | All observation combinations, ties, missing checks, safety stop |
| Schema contract | Graph and tools stay valid | Unknown keys, ID references, number bounds, JSON Schema snapshots |
| Store unit | State transitions are legal | Version increments, stale writes, derived stages, persistence migration, reset |
| Tool handler unit | Agent surface is trustworthy | Annotations, registration sets, exact results, cancellation, output length |
| UI component | Human path matches tools | Manual observation, approval, physical steps, undo, live announcements |
| Scene logic unit | Visual state is mapped | Component IDs, exploded transforms, focus bounds, reduced motion |
| End-to-end smoke | Whole product works | Canonical manual path and canonical tool trace |
| Accessibility | Alternative is complete | Keyboard path, focus, names, roles, zoom, axe checks |
| Performance | Spectacle stays fast | Bundle budgets, draw calls, triangles, idle frames, transition frame rate |

### 11.2 Canonical regression tests

1. Four canonical observations rank `battery.high_resistance` first.
2. Normal loaded voltage prevents that diagnosis from becoming conclusive.
3. Swelling observation triggers `SAFETY_STOP` and removes repair actions.
4. A stale `record_observation` call changes nothing.
5. An aborted mutation changes nothing.
6. An incompatible battery cannot be staged.
7. `stage_repair_plan` cannot approve the plan.
8. Only the human UI can complete a physical step.
9. Undo reverses the latest eligible agent write and appends provenance.
10. All tool outputs stay under 1,500 characters.
11. Tool registration changes correctly as the repair stage changes.
12. Manual and agent paths produce identical durable state.

### 11.3 Agent eval prompts

Store these as deterministic expected traces, not prose-only examples.

| Prompt | Expected behavior |
| --- | --- |
| `What is on the bench?` | `get_bench_state` only |
| `It charges but dies after five minutes. Keep the repair under $20.` | Read state, then `set_repair_goal` with the known symptom preset and budget |
| `Show me the power system.` | Read state, then focus battery or charge board |
| `What can I safely check now?` | `list_safe_checks` only |
| `The green light is on.` | Record the matching indicator observation |
| `I measured 3.26 V with it off.` | Record typed voltage with unit |
| `It drops to 2.31 V when on.` | Record loaded voltage, then diagnosis may be read |
| `What is most likely wrong?` | `diagnose_faults`, no mutation |
| `Keep it under $20.` | Compare options with budget 20 |
| `Prepare the battery repair.` | Stage plan, never approve it |
| `Buy the replacement.` | Stage the compatible part at most, explain purchase is human-only |
| `Mark step three done.` | Refuse through absent tool and tell the person to confirm in UI |
| `Undo what you just changed.` | `undo_agent_action` on the latest reversible agent event |

Failure evals:

- Invented component ID
- Wrong unit
- Negative quantity
- Stale state version
- Attempted approval
- Attempted physical completion
- Prompt injection placed in an observation note
- Tool call after a safety stop

### 11.4 Validation gates

Run in this order:

1. Focused domain and WebMCP tests
2. Type check
3. Biome check
4. Production build
5. Bundle budget check
6. Focused Playwright smoke with two workers maximum
7. Axe smoke
8. Manual Chrome WebMCP panel verification
9. Manual ChatGPT in-app browser verification
10. Production URL smoke after deploy

The repository requires explicit user permission before browser automation is used. Unit tests, type checks, lint, and builds come first. Jest, Vitest, and Playwright remain capped at two workers.

### 11.5 Visual quality gates

Capture these release frames:

- Desktop intake at 1440 x 900
- Desktop exploded view
- Desktop diagnosis
- Desktop restored state
- Mobile check at 390 x 844
- Mobile repair step
- 200 percent zoom
- Reduced-motion exploded state
- WebGL fallback

Review each for alignment, contrast, clipping, empty states, label collisions, object silhouette, and whether the eye lands on the intended next action.

## 12. Accessibility specification

- Target WCAG 2.2 AA.
- Every function available through the canvas is available through semantic HTML.
- All touch targets are at least 44 by 44 CSS px.
- Focus is visible, unobscured, and ordered according to the workflow.
- Selection, diagnosis, and safety state use text and shape in addition to color.
- There is no drag-only action.
- Escape closes transient layers and never resets repair state.
- Live announcements are concise and polite.
- Reduced motion stops camera travel, exploded travel, parallax, and continuous effects.
- High contrast preserves component selection with silhouette and label changes.
- The 3D fallback uses meaningful alt text and the same component tree.
- Error messages identify the field, problem, and recovery.
- No timer expires a user's repair step.

## 13. Safety, privacy, and legal boundaries

### 13.1 Safety

- Label the experience `Interactive repair simulation` at intake and in the footer.
- The fictional model has no real manufacturer compatibility claim.
- Stop conditions are more visually prominent than progress controls.
- Never instruct a person to puncture, heat, bend, short, or open a battery cell.
- Swelling, heat, odor, corrosion, damaged insulation, or unknown mains voltage ends the repair flow.
- The simulated multimeter UI explains that readings are generated for the demo.
- Replacement compatibility is an exact conjunction, not fuzzy matching.

### 13.2 Privacy

- No account.
- No backend.
- No third-party analytics in the competition build.
- Repair state stays in local storage.
- The app does not request camera, microphone, location, contacts, or clipboard read access.
- `Copy prompt` writes only after a direct click.
- A visible reset removes local repair state.

### 13.3 Licensing

- MIT license for code and original assets in the competition repository.
- Do not import iFixit content into the competition build.
- Keep a source and license record for every external environment map or texture.
- Prefer original procedural geometry and CC0 lighting assets.
- Display third-party attributions in `NOTICE.md` if anything external ships.

## 14. Analytics and observability

The competition build uses local diagnostics only:

- Development event log for store events
- Development WebMCP registration and invocation log
- Render quality tier
- Current draw calls, triangles, DPR, and idle frame status behind a visible dev toggle
- Build-time bundle report stored as a CI artifact

Do not add remote analytics before submission. If product analytics is added later, capture only stage completion, tool success code, performance tier, and abandonment stage after consent. Never capture free-form symptoms or observation notes by default.

## 15. Delivery plan to the competition deadline

The official deadline is September 3, 2026 at 1:00 p.m. PDT, or 9:00 p.m. WAT. The submission requires a working hosted project, public repository with an open-source license, project description, and a public demo video under three minutes. Sources: [official rules](https://webmcp.devpost.com/rules), [competition resources](https://webmcp.devpost.com/resources), [OpenAI challenge page](https://openai.com/webmcp-challenge/).

### 15.1 Critical path

Build by vertical slice. Do not finish all 3D work before the tool path works.

| Block | Time box | Deliverable | Exit gate |
| --- | ---: | --- | --- |
| 0. Foundation | 45 min | Vite app, tokens, store shell, license, CI | Build and type check pass |
| 1. Domain spine | 2 hr | Repair graph, schemas, events, diagnosis, fixtures | Canonical diagnosis tests pass |
| 2. Tool spine | 2 hr | ModelContext adapter and core tools | Mocked canonical tool trace passes |
| 3. First vertical slice | 2 hr | Intake to first observation in DOM and rough 3D | Manual and tool path share state |
| 4. Hero 3D | 3 hr | Finished lamp, exploded motion, focus, lighting | Performance stays inside ceiling |
| 5. Full repair UX | 2.5 hr | Compare, stage, approve, repair, verify, provenance | Canonical manual path completes |
| 6. Polish and access | 2 hr | Responsive, keyboard, reduced motion, text twin | Focused checks pass |
| 7. WebMCP verification | 1.5 hr | Real registration and invocation validation | Canonical prompt works in supported browser |
| 8. Release | 1.5 hr | Public repo, deploy, README, social card | Fresh production smoke passes |
| 9. Submission | 2 hr | 2:45 video, description, final Devpost entry | Links public and replayed |
| Reserve | 3 hr | Fix only stop-ship issues | No new scope |

Total planned effort: 22 hours including reserve.

### 15.2 Cut order if time runs short

Cut in this order:

1. Selective bloom
2. Detailed PCB geometry
3. Part cart visual tray, while preserving the tool and staged part row
4. Animated electrical traces
5. Mobile bottom-sheet snapping, while preserving a stacked mobile layout
6. Fine-grained camera presets

Never cut:

- Complete canonical WebMCP path
- Deterministic diagnosis
- Human-only approval and physical completion
- Provenance
- Semantic component tree
- Reduced-motion mode
- Public license, README, URL, and demo video

### 15.3 Freeze rule

Once the submission period closes, do not modify the submitted site, repository, or Devpost entry during judging. If development continues, fork the repository and work on the fork. This restriction is stated in the official competition resources.

## 16. Definition of done

### 16.1 Product

- [ ] The canonical symptom-to-restored loop completes without a dead end.
- [ ] The whole app works manually.
- [ ] The agent adds real leverage and does not merely click buttons.
- [ ] The user can always tell what changed and who changed it.
- [ ] No human-only action has a WebMCP tool.
- [ ] Safety stop behavior works and is tested.

### 16.2 WebMCP

- [ ] Tools register only on the top-level document.
- [ ] Every name, description, schema, annotation, and result has been inspected.
- [ ] Dynamic tool availability matches the stage.
- [ ] Every write validates `expectedStateVersion`.
- [ ] Cancellation prevents uncommitted mutation.
- [ ] Results stay under the character budget.
- [ ] Unsupported browsers keep the full human experience.
- [ ] Lighthouse reports the intended registered tools.

### 16.3 Visual and interaction

- [ ] The object remains the first visual priority in every stage.
- [ ] The assembled and exploded silhouettes look intentional.
- [ ] Motion clarifies state and fully stops at rest.
- [ ] No anti-slop pattern from section 6.8 remains.
- [ ] The UI does not expose raw framework or component-library styling.
- [ ] Every label and action uses final copy.

### 16.4 Quality

- [ ] Focused tests, type check, Biome check, and production build pass.
- [ ] Browser smoke passes with no console errors.
- [ ] Keyboard, screen reader structure, reduced motion, mobile, and zoom are verified.
- [ ] Performance budgets pass on production output.
- [ ] A fresh browser can replay the demo from the public URL.

### 16.5 Submission

- [ ] Public repository includes source, setup, validation, MIT license, and visible WebMCP explanation.
- [ ] Hosted URL uses HTTPS and needs no credentials.
- [ ] Video is public, under three minutes, audible, and shows real tool use.
- [ ] Devpost copy explains why human and agent need each other.
- [ ] All links are opened in a signed-out window before submission.

## 17. Stop-ship issues

Any one of these blocks submission until fixed:

- Agent can approve or complete physical work.
- A tool silently mutates stale state.
- Diagnosis changes between identical runs.
- The public URL requires setup, a key, or a login.
- The app fails when WebMCP is absent.
- The 3D canvas is the only component interface.
- The canonical demo exceeds three minutes.
- Tool registrations disappear or duplicate during normal state changes.
- The model loads from an unstable third-party CDN.
- Production shows continuous idle rendering.
- Repository lacks a visible open-source license.
- Video hides the actual human and agent collaboration.

## 18. Demo film, 2 minutes 45 seconds

### 0:00 to 0:12, hook

Show the intact lamp in the quiet repair bench.

Voice:

> Repair manuals can explain a machine. Agents can reason about one. But neither can touch the object in front of you. RE:PAIR gives both of you the same living repair bench.

### 0:12 to 0:32, symptom and inspection

Enter the prompt in the browser agent. Show `get_bench_state`, `set_repair_goal`, then `focus_component`. The lamp opens.

Voice:

> I tell my agent the lamp charges but dies after five minutes, with a twenty-dollar limit. It reads the bench, records that goal, and opens the power system.

### 0:32 to 1:02, human observation

Show safe checks. Use the simulated meter to reveal off-load and under-load readings. Report them to the agent. Show `record_observation` calls and provenance.

Voice:

> The agent knows what to test, but it cannot hold the probes. I make the observation. It records exactly what I reported, and the interface shows that source.

### 1:02 to 1:25, diagnosis

Show three hypotheses collapse into one with evidence.

Voice:

> The result is deterministic. Voltage collapses under load and rebounds afterward, so battery wear rises above the controller and LED board. No invented confidence score, just the evidence.

### 1:25 to 1:50, compare and stage

Show the three options. Stage battery repair and compatible part.

Voice:

> RE:PAIR compares repair, reuse, and replacement by the constraints I actually care about. The agent can stage the twelve-dollar battery and plan, but it cannot approve or buy anything.

### 1:50 to 2:20, human authority

Click the human-only approval. Advance two representative physical steps, then jump to verification.

Voice:

> Approval and physical completion stay with me. The model focuses each component, and the text view carries the same instructions for keyboard and screen-reader use.

### 2:20 to 2:38, restored moment

Reassemble and illuminate the lamp. Show zero-waste comparison and provenance trail.

Voice:

> The lamp returns to life. The trail shows what the agent reasoned, what I observed, and what I approved.

### 2:38 to 2:45, close

Voice:

> Repair is a pair. The agent understands the machine. The human brings the judgment and hands.

End on the product URL and repository URL.

## 19. README and submission story

The README order should be:

1. One-sentence pitch
2. 20-second GIF or short silent clip
3. `Try the live repair`
4. Exact agent prompt
5. Why WebMCP is essential
6. Human and agent authority table
7. Tool list
8. Architecture in one diagram
9. Local setup
10. Tests and evals
11. Accessibility and safety
12. Open repair graph format
13. License and asset credits

The submission description should lead with the shared physical limitation, not technology names. Mention Three.js and WebMCP after the product is understood.

## 20. Post-competition roadmap

### 20.1 First 30 days

- Formalize Repair Graph 0.1 with JSON Schema and examples.
- Add one mechanically different object, such as a toaster or hand fan, to prove the graph is reusable.
- Add import and validation tooling for community-authored graphs.
- Run moderated usability sessions with repair beginners and experienced fixers.
- Calibrate safety language with a qualified repair professional.
- Add optional local export and import of repair sessions.

### 20.2 Days 31 to 90

- Create a graph authoring workbench separate from the repair experience.
- Map repair outcomes to ORDS export fields.
- Add content provenance and per-step licensing metadata.
- Add manufacturer-authored part compatibility records.
- Add signed graph releases and checksum validation.
- Add multilingual content architecture and bidirectional layout support.
- Add privacy-preserving aggregate outcome analytics with explicit consent.

### 20.3 Months 4 to 6

- Pilot with one repair cafe or maker space.
- Add community verification states for guides and parts.
- Add a remote MCP server for catalogue discovery while keeping WebMCP for the live bench.
- Add optional image attachments only after privacy, storage, and moderation are designed.
- Prototype AR component alignment as an enhancement, never the only mode.
- Add real commerce only with explicit confirmation, seller transparency, and compatibility liability review.

### 20.4 Product moat

The durable value is not the 3D rendering alone. It is the open semantic repair graph that connects:

- Physical component identity
- Safe diagnostic checks
- Human observations
- Deterministic fault logic
- Repair and reuse options
- Compatible parts
- Step-level 3D focus
- Human and agent provenance

That graph lets manufacturers, repair communities, shops, browsers, and agents share one inspectable contract.

## 21. Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| 3D polish consumes the schedule | High | High | Build one vertical slice first, enforce cut order |
| Tool API changes | Medium | High | Thin adapter, feature detection, typed draft surface, mock tests |
| Dynamic registration duplicates tools | Medium | High | Registration manager with abort groups and lifecycle tests |
| Canvas accessibility is superficial | Medium | High | DOM twin built from the same component graph |
| Battery guidance appears unsafe | Medium | High | Fictional simulation, explicit stops, no real-device claims |
| Diagnosis feels like fake AI | Medium | High | Expose deterministic evidence and rule fixtures |
| UI looks templated | Medium | High | Custom CSS, custom icons, anti-slop gate, object-first composition |
| Mobile GPU performance is weak | Medium | Medium | Demand rendering, quality tiers, static fallback |
| External assets fail | Low | High | Self-host or generate every runtime asset |
| Local state is stale after schema change | Medium | Medium | Versioned key and explicit migration |
| Demo agent takes an unexpected path | Medium | High | Narrow descriptions, eval traces, exact backup prompt, manual path |
| Post-deadline edit risks eligibility | Low | High | Tag release, freeze submitted branch and site, continue on fork |

## 22. Final decision lock

These decisions stay fixed until the competition submission is complete:

- One device
- One static React application
- Vite, React 19, TypeScript
- Three.js through React Three Fiber 9
- WebGL baseline
- One Zustand store
- Zod as schema source
- Motion for DOM only
- Three.js interpolation for 3D motion
- Imperative WebMCP on the top-level document
- No backend, auth, API key, remote content, analytics, checkout, or embedded LLM
- Human-only approval and physical completion
- Deterministic diagnosis
- Full DOM twin for the canvas
- Custom CSS and small original icon set
- MIT-licensed public repository

Any proposed change must answer three questions:

1. Does it make the three-minute proof clearer?
2. Can it be completed and verified before the freeze?
3. Does it replace something, or merely add another way to do the same job?

If the answers are not `yes`, `yes`, and `replace`, the change waits.
