# Submission copy

## Short description

RE:PAIR is a living 3D repair manual where a browser agent understands the machine and a person brings observations, judgment, approval, and physical action.

## Full description

Repair information is scattered across manuals, videos, forums, and part listings. A person has the object but may not understand the whole system. A browser agent can interpret structured knowledge but cannot see a loose wire, hold a probe, approve risk, or complete a physical step.

RE:PAIR gives both sides one inspectable workbench. Its competition demo follows the fictional Aurelia S1 solar study lamp from a five-minute runtime symptom to a verified battery replacement. The agent uses narrow WebMCP tools to read state, focus components, list safe checks, record a person's observations, run deterministic fault rules, compare outcomes, and stage a compatible plan and part. Approval, purchase, physical completion, and verification remain outside the agent tool surface.

The semantic Repair Graph 0.1 format connects component identity, safety rules, observations, explanation codes, repair options, compatible parts, 3D focus, and provenance. React, Three.js, React Three Fiber, Zustand, and Zod run entirely in a static client application. There is no backend, account, embedded model, analytics service, or remote runtime data source.

The canvas is an enhancement. A synchronized HTML component hierarchy provides the same selection and state information, with keyboard controls, reduced motion, responsive layouts, visible focus, live announcements, and a static fallback for WebGL failure.

## Human and agent contract

The agent may understand and stage. The person must observe, approve, act, and verify.

## Competition category notes

- WebMCP tools are registered imperatively on the top-level document.
- Every visible tool write uses optimistic state versioning.
- Tool registration changes with repair stage through abortable groups.
- Tool inputs and Repair Graph data are validated by Zod.
- Diagnostic ranking is deterministic and tested.
- Every durable event records actor, origin, versions, timestamp, and changes.
