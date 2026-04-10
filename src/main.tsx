import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

Sentry.init({
  dsn: "https://8f2c43b81696e0bcb5ec8c2c34ab64eb@o4511025445339136.ingest.de.sentry.io/4511025447698512",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
});

function setupClientGuards() {
  if (import.meta.env.DEV) return;

  document.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener(
    "keydown",
    (event) => {
      const key = event.key.toLowerCase();
      const blocked =
        key === "f12" ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
        (event.ctrlKey && key === "u");

      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );

  // Best-effort heuristic only; this is not a complete prevention mechanism.
  setInterval(() => {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const devtoolsOpen = widthDiff > 160 || heightDiff > 160;
    document.documentElement.toggleAttribute("data-devtools-open", devtoolsOpen);
  }, 2000);
}

setupClientGuards();

createRoot(document.getElementById("root")!).render(<App />);
