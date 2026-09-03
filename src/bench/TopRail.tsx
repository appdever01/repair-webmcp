import { FaGithub, FaStar } from "react-icons/fa6";
import { RepairIcon } from "../design/RepairIcon";
import { useWorkspaceStore, workspaceStore } from "../workspace";

const pageLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#agents", label: "Agents" },
  { href: "#agent-guide", label: "Try it" },
] as const;

export function TopRail() {
  const inWorkspace = useWorkspaceStore((state) => state.analysis !== null);

  return (
    <header className="top-rail">
      <a className="wordmark" href="#main-content" aria-label="RE:PAIR home">
        <img src="/repair-logo.png" alt="" width="32" height="32" />
        <span className="wordmark-text">
          RE<span aria-hidden="true">:</span>PAIR
        </span>
      </a>
      {inWorkspace ? (
        <p className="top-rail-status">
          <span className="status-dot" aria-hidden="true" />
          Workspace live
        </p>
      ) : (
        <nav className="top-nav" aria-label="Page">
          {pageLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      )}
      <div className="top-rail-actions">
        <a
          className="github-star"
          href="https://github.com/appdever01/repair-webmcp"
          target="_blank"
          rel="noreferrer"
          aria-label="Star on GitHub"
        >
          <FaGithub size={16} />
          <FaStar size={14} />
          <span>Star</span>
        </a>
        <button
          type="button"
          className="top-rail-reset"
          aria-label="Reset workspace"
          onClick={() => {
            if (window.confirm("Reset this workspace and remove the selected photo from memory?")) {
              workspaceStore.getState().reset();
            }
          }}
        >
          <RepairIcon name="reset" size={18} />
          <span>Reset</span>
        </button>
      </div>
    </header>
  );
}
