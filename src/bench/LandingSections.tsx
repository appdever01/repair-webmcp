import { type AgentToolName, agentToolMetadata } from "../agent-runtime";
import { RepairIcon } from "../design/RepairIcon";

const steps = [
  {
    title: "Show the object",
    body: "Drop, paste, or choose one clear photo. Add a line about what seems wrong if you know it.",
  },
  {
    title: "Read the hypotheses",
    body: "OpenAI names the object, marks areas to inspect, and lists possible issues with confidence and stop conditions.",
  },
  {
    title: "Add what only you can see",
    body: "Answer the clarifying questions from the real object. An agent can open a question, but never answers it for you.",
  },
  {
    title: "Take one cautious step",
    body: "Guidance weighs evidence for and against each cause, then offers one safe next action. High-risk objects stop at qualified help.",
  },
];

const agentToolNames = Object.keys(agentToolMetadata) as AgentToolName[];

const humanOnly = [
  "Choose a photo from this device",
  "Make a physical observation",
  "Approve a repair or buy a part",
  "Mark physical work complete",
];

const agents = ["ChatGPT", "Claude", "Codex", "Any MCP"] as const;

const guide = [
  {
    title: "Open RE:PAIR from your agent",
    body: "ChatGPT, Claude, Codex, or any AI that supports MCP. It sees the tools on this page.",
  },
  {
    title: "Watch the dock",
    body: "When it connects, the activity dock shows the tools that fit this step.",
  },
  {
    title: "Ask it to help",
    body: 'Try "Read the workspace state, then open the image uploader." You still choose the photo.',
  },
];

export function HowItWorks() {
  return (
    <section className="landing-section" id="how-it-works" aria-labelledby="how-title">
      <div className="landing-heading">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title">Four short steps. You stay in charge.</h2>
      </div>
      <ol className="step-grid">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span>0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ObjectShowcase() {
  return (
    <section className="object-showcase" aria-labelledby="object-showcase-title">
      <div className="object-showcase-heading">
        <p className="eyebrow">Built for everyday objects</p>
        <h2 id="object-showcase-title">The things you actually use.</h2>
      </div>
      <div className="object-stage">
        <figure className="repair-object repair-object-phone">
          <img
            src="/repair-phone.png"
            alt="A phone with a cracked screen and loose charging port highlighted."
            width="488"
            height="760"
            loading="lazy"
            decoding="async"
          />
          <figcaption>Cracked screen</figcaption>
        </figure>
        <figure className="repair-object repair-object-sneaker">
          <img
            src="/repair-sneaker.png"
            alt="A sneaker with a peeling sole highlighted and its layers separated."
            width="760"
            height="461"
            loading="lazy"
            decoding="async"
          />
          <figcaption>Peeling sole</figcaption>
        </figure>
        <figure className="repair-object repair-object-bike">
          <img
            src="/repair-bike.png"
            alt="A bicycle with its slipped chain and rear gear highlighted."
            width="760"
            height="452"
            loading="lazy"
            decoding="async"
          />
          <figcaption>Slipped chain</figcaption>
        </figure>
      </div>
    </section>
  );
}

export function AgentSection() {
  return (
    <section className="landing-section" id="agents" aria-labelledby="agents-title">
      <div className="landing-heading">
        <p className="eyebrow">Built for browser agents</p>
        <h2 id="agents-title">The same workspace, exposed as WebMCP tools.</h2>
        <p>
          RE:PAIR registers tools on <code>document.modelContext</code>, so an agent running in your
          browser can read the workspace, explode the 3D model, focus a hotspot, open a question, or
          draft guidance. Only the tools that fit the current step are registered, every write
          carries a state version, and each call appears in the activity dock with its source,
          timing, and effect.
        </p>
      </div>
      <div className="agent-columns">
        <div>
          <h3>What the agent can do</h3>
          <ul className="tool-list">
            {agentToolNames.map((name) => (
              <li key={name}>
                <code>{name}</code>
                <span>{agentToolMetadata[name].description}</span>
                <small>
                  {agentToolMetadata[name].classification === "read-only" ? "read only" : "write"}
                </small>
              </li>
            ))}
          </ul>
        </div>
        <div className="human-only">
          <h3>What only you can do</h3>
          <ul>
            {humanOnly.map((item) => (
              <li key={item}>
                <RepairIcon name="shield" />
                {item}
              </li>
            ))}
          </ul>
          <p>
            No tool exists for these. The agent sees the request, you complete it in the visible
            workspace.
          </p>
        </div>
      </div>
    </section>
  );
}

export function AgentGuide() {
  return (
    <section className="landing-section" id="agent-guide" aria-labelledby="guide-title">
      <div className="guide-panel">
        <div className="guide-split">
          <div>
            <div className="landing-heading">
              <p className="eyebrow">Bring your own agent</p>
              <h2 id="guide-title">Use ChatGPT, Claude, or Codex.</h2>
              <p>
                If your AI speaks MCP, it can drive this workspace. You still choose the photo and
                make the physical calls.
              </p>
            </div>
            <ul className="guide-agents" aria-label="Supported agents">
              {agents.map((name) => (
                <li key={name}>
                  <RepairIcon name="agent" size={14} />
                  {name}
                </li>
              ))}
            </ul>
            <ol className="guide-list">
              {guide.map((item, index) => (
                <li key={item.title}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="guide-note">
              <RepairIcon name="info" /> No agent nearby? Open the activity dock and choose Preview
              guided activity. Same path, labeled Guided demo.
            </p>
          </div>
          <figure className="guide-visual">
            <img
              src="/agent-guide-session.webp"
              alt="ChatGPT, Claude, and Codex connected to a RE:PAIR workspace showing a broken mug with lime hotspot markers."
              width="1200"
              height="800"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        <strong>RE:PAIR</strong> is open source under the MIT License.{" "}
        <a href="https://github.com/appdever01/repair-webmcp" rel="noreferrer">
          Source on GitHub
        </a>
      </p>
    </footer>
  );
}
