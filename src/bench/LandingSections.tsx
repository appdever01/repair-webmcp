import { RepairIcon } from "../design/RepairIcon";

const steps = [
  {
    title: "Show the object",
    body: "Add one clear photo.",
  },
  {
    title: "See the damage",
    body: "Review marked areas and likely causes.",
  },
  {
    title: "Confirm the details",
    body: "Add what the photo cannot show.",
  },
  {
    title: "Repair carefully",
    body: "Follow one safe step at a time.",
  },
];

const capabilities = [
  {
    icon: "inspect" as const,
    title: "Focused diagnosis",
    body: "Visible damage becomes a clear set of marked areas.",
  },
  {
    icon: "cube" as const,
    title: "Interactive context",
    body: "Explore the object and its damage from useful angles.",
  },
  {
    icon: "repair" as const,
    title: "Step-by-step guidance",
    body: "Move through practical checks and repair steps in order.",
  },
] as const;

const humanOnly = [
  "Choose the photo",
  "Confirm the real-world details",
  "Decide whether to continue",
  "Complete the physical repair",
];

export function HowItWorks() {
  return (
    <section className="landing-section" id="how-it-works" aria-labelledby="how-title">
      <div className="landing-heading">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title">
          Four short steps. <span>You stay in charge.</span>
        </h2>
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
    <section className="object-showcase" id="objects" aria-labelledby="object-showcase-title">
      <div className="object-showcase-heading">
        <p className="eyebrow">Built for everyday objects</p>
        <h2 id="object-showcase-title">
          The things <span>you actually use.</span>
        </h2>
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
    <section className="landing-section" id="capabilities" aria-labelledby="capabilities-title">
      <div className="landing-heading">
        <p className="eyebrow">Built-in intelligence</p>
        <h2 id="capabilities-title">
          From photo <span>to next step.</span>
        </h2>
        <p>AI keeps the diagnosis clear, the guidance practical, and every decision yours.</p>
      </div>
      <div className="capability-layout">
        <ul className="capability-grid">
          {capabilities.map((capability) => (
            <li key={capability.title}>
              <RepairIcon name={capability.icon} size={20} />
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </li>
          ))}
        </ul>
        <div className="human-only">
          <h3>You stay in control</h3>
          <ul>
            {humanOnly.map((item) => (
              <li key={item}>
                <RepairIcon name="shield" />
                {item}
              </li>
            ))}
          </ul>
          <p>RE:PAIR supports the decision. You handle the object.</p>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        <strong>RE:PAIR</strong> · Repair with clarity.
      </p>
    </footer>
  );
}
