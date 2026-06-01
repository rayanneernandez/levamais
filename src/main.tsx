// Force cache invalidation - React 18.3.1
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCapacitor } from "./lib/capacitor";

// Inicializa plugins nativos se estiver rodando no Capacitor
initCapacitor();

createRoot(document.getElementById("root")!).render(<App />);
