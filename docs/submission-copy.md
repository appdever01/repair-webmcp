# Submission copy

## Short description

RE:PAIR turns a photo of an everyday object into an accessible repair workspace with visible browser-agent activity, synchronized 2D/3D hotspots, human-owned observations, and cautious next-step guidance.

## Full description

Most people start a repair with an object and a phone photo, not a service manual. RE:PAIR meets them there. A person uploads a JPEG, PNG, or WebP image, sees an immediate local preview, adds optional context, and decides when external processing begins.

OpenAI returns a strict analysis describing the likely object, visible condition, possible issues, uncertainty, repair hotspots, clarifying questions, stop conditions, and safety category. The person can correct the displayed object name without invalidating the server-signed analysis. When safe, the configured image-to-3D provider builds a GLB from a prepared reference. React Three Fiber provides orbit, zoom, reset, and keyboard-accessible camera alternatives.

The 3D canvas is never the only path. A model-generation, loading, expiry, WebGL, or CORS failure preserves the interactive uploaded photo and the semantic hotspot list. Photo hotspots, 3D overlays, list selections, and browser-agent focus actions all update one shared focus state.

Clarifying answers are entered only through explicit human controls. Repair guidance treats every cause as a hypothesis and presents evidence for, evidence against, unknowns, limitations, and stop conditions before one clear next action. High-risk categories take a deterministic professional-help-only path with no actionable repair instructions.

The landing page explains the contract before anyone uploads: a four-step overview, the live tool manifest next to the actions only a person can take, and a short guide for trying RE:PAIR with a WebMCP-capable Chrome and Google's Model Context Tool Inspector.

RE:PAIR also makes WebMCP observable. An always-discoverable activity dock reports the number of available actions and shows each tool’s source, title, lifecycle, timestamp, elapsed time, redacted summaries, and resulting visible change. Real calls are labeled `Browser agent`; local scripted invocations are labeled `Guided demo`. Image base64, credentials, session tokens, signed provider URLs, and chain-of-thought are never displayed.

The browser agent may read state, open the uploader, start or cancel a task, focus a hotspot, open a human question, and draft guidance. It cannot choose a local file, make a physical observation, approve a repair, or mark physical work complete. Manual mode uses the same shared action layer and remains fully functional without WebMCP.

## Architecture summary

- React 19, TypeScript, Vite, Zustand, Zod, Three.js, React Three Fiber, and Drei.
- Stateless same-origin serverless APIs for OpenAI analysis, optional image normalization, signed provider-job polling, and repair-plan drafting.
- Short-lived HMAC tokens bind the selected image and immutable analysis without storing either.
- Client-side image compression, abort propagation, bounded polling backoff, session-only provenance, and object-URL cleanup.
- Observable stage-aware WebMCP registration with strict schemas, optimistic state-version checks, cancellation, redaction, and visible effects for every mutation, verified against real Chromium with the WebMCP testing feature in CI.
- Private IconJar package exposed only through the shared `RepairIcon` component.

## Human and agent contract

The agent may understand, navigate, and draft. The person must select, observe, approve, act, and verify.

## Safety statement

RE:PAIR offers cautious informational guidance from limited evidence. It does not confirm hidden condition, exact compatibility, or professional safety. Any stop condition or professional-help classification outranks product progress.
