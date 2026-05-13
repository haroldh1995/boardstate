import "./styles.css";
import { createStore } from "./state/store.js";
import { mountApp } from "./ui/render.js";

const root = document.querySelector("#app");
const store = createStore();

mountApp(root, store);
store.init();
