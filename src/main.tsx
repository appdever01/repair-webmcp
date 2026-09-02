import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./design/tokens.css";
import "./app/styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root was not found.");
}

createRoot(root).render(<App />);
