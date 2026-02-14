import ReactDOM from "react-dom/client";
import App from "./App";
import "./tauri-shim";
import appCss from "./App.css?inline";
import appCssUrl from "./App.css?url";

function injectCss(css: string) {
  if (document.querySelector('style[data-inline-app-css="true"]')) {
    return;
  }
  const style = document.createElement("style");
  style.setAttribute("data-inline-app-css", "true");
  style.textContent = css;
  document.head.appendChild(style);
}

// Fallback for packaged environments where <link rel="stylesheet"> may fail.
// Fetching CSS as text avoids MIME/protocol edge cases.
fetch(appCssUrl)
  .then((res) => (res.ok ? res.text() : Promise.reject(new Error(res.statusText))))
  .then((css) => injectCss(css))
  .catch(() => injectCss(appCss));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
