import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "@fontsource/young-serif/400.css";
import "@fontsource-variable/hanken-grotesk/wght.css";
import "./design/tokens.css";
import "./styles.css";
import "./theme.css";
import "./landing.css";
import "./garden.css";
import "./secondary.css";
import "./clinic.css";
import "./patient.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
