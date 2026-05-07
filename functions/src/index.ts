import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions";

initializeApp();

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

export * from "./polls.js";
export * from "./votes.js";
export * from "./calendar.js";
