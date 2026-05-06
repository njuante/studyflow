import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TagsProvider } from "./hooks/useTags";
import "./styles/global.css";
import "./styles/tokens.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TagsProvider>
      <App />
    </TagsProvider>
  </React.StrictMode>,
);
