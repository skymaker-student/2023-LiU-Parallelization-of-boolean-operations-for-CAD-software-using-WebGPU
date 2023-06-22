import "./app.css";
import "./lib/debug/debug.css";
import App from "./App.svelte";
import "./lib/util";

import "./lib/testing";

if (window.location.pathname === "/reset") {
    localStorage.clear();
    window.location.pathname = "";
}

const app = new App({
    target: document.body,
});

export default app;
