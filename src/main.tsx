import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import { useScrollToTop } from "./hooks/useScrollToTop";

function AppWithScrollToTop() {
  useScrollToTop();
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AppWithScrollToTop />
  </BrowserRouter>
);
