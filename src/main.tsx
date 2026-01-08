import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import App from "./App.tsx";
import "./index.css";

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogHost || "https://us.i.posthog.com",
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />

  </StrictMode>
);
