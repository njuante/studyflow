import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";

import App from "./App";
import { TagsProvider } from "./hooks/useTags";
import { FocusWindow } from "./windows/FocusWindow";
import { QuickCaptureWindow } from "./windows/QuickCaptureWindow";
import "./styles/global.css";
import "./styles/tokens.css";

const router = createHashRouter([
  { path: "/", element: <App /> },
  { path: "/quick-capture", element: <QuickCaptureWindow /> },
  { path: "/focus", element: <FocusWindow /> },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TagsProvider>
      <RouterProvider router={router} />
    </TagsProvider>
  </React.StrictMode>,
);
