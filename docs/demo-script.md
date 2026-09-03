# RE:PAIR demo script

Target length: 3 minutes

## 0:00–0:20 · Understand the product

Start on the empty state. Keep the heading, upload surface, privacy disclosure, and three-step explanation visible.

Voice:

> Show RE:PAIR one clear photo. It identifies the object, builds an interactive view when it can, and helps you choose a cautious next step without pretending a photo is a diagnosis.

## 0:20–0:45 · Select and start

Drop a photo of an everyday object with visible damage. If a suitable image is unavailable, choose the `broken cup` or `desk lamp` sample. Add one short problem description.

Show the immediate local preview and the replace/remove controls. Start the analysis.

Voice:

> The image stays local until I start the analysis. The browser compresses it before sending it to OpenAI. RE:PAIR does not put uploads in browser storage.

## 0:45–1:15 · Review understanding

Let the progressive states move through `Uploading` and `Understanding the object`. Show the object name, visible condition, possible issues, confidence, safety status, and uncertainty statement. Correct the displayed object name once.

Voice:

> I can correct what the system calls the object. Visible issues remain hypotheses, and hidden condition stays explicitly unknown.

## 1:15–1:45 · Build the visual workspace

Choose `Build 3D model`. Show `Preparing a clean reference`, `Building the 3D model`, and `Finishing the workspace`. Do not narrate a percentage.

When generation succeeds, orbit, zoom, use one keyboard-accessible rotation control, and reset the view. Select one numbered hotspot in 3D, then the same hotspot in the semantic list.

If the provider or GLB fails, continue the demo using the interactive photo. Point out that the same hotspots and list remain available.

Voice:

> The 3D view is useful, but never required. The photo, numbered regions, and text list share one focused state, so a loading or CORS failure does not end the repair path.

## 1:45–2:15 · Keep observations human

Open the next clarifying question. Enter a direct observation through the visible form, or choose `I can’t determine this safely`.

Voice:

> An agent may open a question, but it cannot answer for me. Human observations come only from explicit human controls.

## 2:15–2:40 · Show visible agent activity

Open `Agent activity`. If WebMCP is available, ask the browser agent to read the workspace and focus a hotspot. Otherwise use the guided demo invocation. Keep its `Guided demo` label visible.

Show the tool title, source, lifecycle state, elapsed time, safe summaries, timestamp, and visible change.

Voice:

> Agent work is not hidden. Real browser-agent calls and guided demo calls are labeled separately, and secrets, signed URLs, and private reasoning never appear here.

## 2:40–3:00 · Guidance and authority

Draft guidance. Show stop conditions before the first action, then expand hypotheses to reveal evidence for, evidence against, and unknowns.

For a high-risk fixture, briefly show the professional-help-only stop instead of actionable steps.

Voice:

> The result offers one cautious next action and clear reasons to stop. The agent can understand, focus, and draft. Only a person can observe, approve, act, or say physical work is complete.

End on the production URL. Do not trigger a real provider call during a rehearsed automated test; use mocked contracts or the prepared demo session.
