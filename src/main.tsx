import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PostHogProvider } from "posthog-js/react";
import App from "./App.tsx";
import "./index.css";

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {posthogKey ? (
      <PostHogProvider 
        apiKey={posthogKey}
        options={{
          api_host: posthogHost || 'https://us.i.posthog.com',
        }}
      >
        <App />
      </PostHogProvider>
    ) : (
      <App />
    )}
  </StrictMode>
);
