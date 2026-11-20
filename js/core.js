
const $ = id => document.getElementById(id);
const statusEl = $("status"), video = $("video"), stage = $("stage");
function setStatus(text, cls) { statusEl.textContent = text; statusEl.className = cls || ""; }
const DEMO = location.hash === "#demo";            // built-in test scene, no camera needed
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODELS = "https://storage.googleapis.com/mediapipe-models/";
const FACE_MODEL = MODELS + "face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = MODELS + "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
let META;

