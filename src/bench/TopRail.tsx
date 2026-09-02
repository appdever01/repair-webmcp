import { RepairIcon } from "../design/RepairIcon";
import { workspaceStore } from "../workspace";

export function TopRail() {
  return (
    <header className="top-rail">
      <a className="wordmark" href="#main-content" aria-label="RE:PAIR home">
        <img src="/repair-logo.png" alt="" width="32" height="32" />
        <span className="wordmark-text">
          RE<span aria-hidden="true">:</span>PAIR
        </span>
      </a>
      <p className="powered-by">Powered by OpenAI</p>
      <button
        type="button"
        className="quiet-icon-button"
        aria-label="Reset workspace"
        onClick={() => {
          if (window.confirm("Reset this workspace and remove the selected photo from memory?")) {
            workspaceStore.getState().reset();
          }
        }}
      >
        <RepairIcon name="reset" />
      </button>
    </header>
  );
}
