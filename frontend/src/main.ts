import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import ScheduleView from "./views/ScheduleView.vue";
import StatsView from "./views/StatsView.vue";
import MapView from "./views/MapView.vue";
import ShipView from "./views/ShipView.vue";
import "./style.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: ScheduleView },
    { path: "/map", component: MapView },
    { path: "/stats", component: StatsView },
    { path: "/ship/:name", component: ShipView },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
