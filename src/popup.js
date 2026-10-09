import React from "react";
import ReactDOM from "react-dom/client";
import { SettingProvider } from "./hooks/Setting";
import ThemeProvider from "./views/Popup/PopupTheme";
import Popup from "./views/Popup";
import { APP_CONTEXT_KEY } from "./libs/browser";

// Identify the popup context for shared libraries.
globalThis[APP_CONTEXT_KEY] = "popup";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {/* Provide global settings and theme contexts. */}
    <SettingProvider context="popup">
      <ThemeProvider>
        <Popup />
      </ThemeProvider>
    </SettingProvider>
  </React.StrictMode>
);
