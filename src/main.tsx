import ReactDOM from "react-dom/client";
import App from "./App";
import "./tauri-shim";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
