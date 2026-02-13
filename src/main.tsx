import ReactDOM from "react-dom/client";
import App from "./App";
import "./tauri-shim";
import appCss from "./App.css?inline";

// Fallback for packaged environments where external CSS asset loading can fail.
if (!document.querySelector('style[data-inline-app-css="true"]')) {
  const style = document.createElement("style");
  style.setAttribute("data-inline-app-css", "true");
  style.textContent = appCss;
  document.head.appendChild(style);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
