// ------------------------------ start-up ------------------------------
let faceTracker = null, handTracker = null;
async function loadTrackers() {
  const vision = await import(MP + "/vision_bundle.mjs");
  const files = await vision.FilesetResolver.forVisionTasks(MP + "/wasm");
  const mkFace = d => vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: d },
    runningMode: "VIDEO", numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: true });
  const mkHand = d => vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL, delegate: d },
    runningMode: "VIDEO", numHands: 2 });
  try { faceTracker = await mkFace("GPU"); } catch (e) { faceTracker = await mkFace("CPU"); }
  try { try { handTracker = await mkHand("GPU"); } catch (e) { handTracker = await mkHand("CPU"); } }
  catch (e) { handTracker = null; }                        // the head view still works without hand tracking
}

function liveLoop() {
  let lastTime = -1, lostAt = 0, said = "";
  const say = (t, c) => { if (said !== t) { said = t; setStatus(t, c); } };
  function tick() {
    requestAnimationFrame(tick);
    if (video.readyState < 2 || video.currentTime === lastTime) return;
    lastTime = video.currentTime;
    const now = performance.now();
    let faceLms = null, hands = [], sides = [];
    try {
      const fr = faceTracker.detectForVideo(video, now);
      faceLms = fr.faceLandmarks && fr.faceLandmarks[0];
      const mat = fr.facialTransformationMatrixes && fr.facialTransformationMatrixes[0];
      if (faceLms && mat) {
        let jaw = 0;
        const bs = fr.faceBlendshapes && fr.faceBlendshapes[0];
        if (bs) for (const c of bs.categories) if (c.categoryName === "jawOpen") jaw = c.score;
        updateHead(mat.data, faceLms, jaw); lostAt = 0;
      } else { faceLms = null; if (!lostAt) lostAt = now; if (now - lostAt > 250) head.found = false; }
      if (handTracker && (S.hands || S.reveal === "lens" || S.showdata)) {
        const hr = handTracker.detectForVideo(video, now);
        hands = hr.landmarks || [];
        const hd = hr.handedness || hr.handednesses || [];
        // The tracker names hands as if the picture were mirrored; ours is not, so the names are swapped.
        sides = hands.map((h, i) => !!(hd[i] && hd[i][0] && hd[i][0].categoryName === "Left"));
      }
    } catch (e) { say("Se ha producido un error en el seguimiento: " + e.message, "bad"); return; }
    say(head.found ? "Siguiendo tu cabeza." + (hands.length ? " Huesos de la mano activados." : "")
                   : hands.length ? "Mano detectada. Mira a la cámara para ver el interior de tu cabeza."
                   : "No se ha detectado ningún rostro. Mira a la cámara con el rostro iluminado.", head.found || hands.length ? "ok" : "bad");
    renderFrame(now, faceLms, hands, sides);
  }
  tick();
}

// Built-in test scene (open the page with #demo): a pretend head and the dataset's own hand, no camera.
function demoLoop() {
  $("intro").hidden = true;
  setStatus("Escena de demostración (sin cámara).", "ok");
  const params = new URLSearchParams(location.search), still = params.has("still");
  const base = META.demoHand, cx = base[9][0], cy = base[9][1], cz = base[9][2];
  function tick() {
    if (!still) requestAnimationFrame(tick);
    const now = performance.now(), t = still ? 1.2 : now / 1000;
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.06 + 0.05 * Math.sin(t * 0.7), 0.42 * Math.sin(t * 0.5 + 0.9), 0.04, "YXZ"));
    m.setPosition(-5 + 2 * Math.sin(t * 0.4), 1.5, -46);
    const lms = [];
    for (const id of FIT_IDS) { const v = new THREE.Vector3().fromArray(META.fit[id]).applyMatrix4(m).applyMatrix4(baseProj); lms[id] = { x: (v.x + 1) / 2, y: (1 - v.y) / 2, z: 0 }; }
    updateHead(m.elements, lms, 0.5 + 0.5 * Math.sin(t * 1.3));
    // the dataset's right hand, fingers pointing up, palm to the camera, placed at the side of the picture
    const k = 0.0021 * H / W * (4 / 3), hand = base.map(p => ({ x: 0.2 - (p[0] - cx) * k, y: 0.56 + (p[2] - cz) * k * W / H, z: (p[1] - cy) * k }));
    renderFrame(now, FIT_IDS.map(id => lms[id]), [hand], [true]);
    if (params.has("dump") && now > 1500 && !demoLoop.dumped) {      // flatten the layers into one picture for testing
      demoLoop.dumped = true;
      const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
      x.fillStyle = "#0b1220"; x.fillRect(0, 0, W, H);
      x.save(); x.translate(W, 0); x.scale(-1, 1); x.drawImage($("shade"), 0, 0, W, H); x.drawImage($("gl"), 0, 0, W, H); x.restore();
      x.drawImage($("hud"), 0, 0);
      const img = new Image(); img.src = c.toDataURL("image/png");
      img.style.cssText = "position:fixed;left:0;top:0;z-index:99;width:" + W + "px;height:" + H + "px";
      document.body.appendChild(img);
      console.log("DEMO dumped", W, H, "fit", head.fitS.toFixed(3), head.fitX.toFixed(3), head.fitY.toFixed(3));
    }
  }
  tick();
}

async function boot() {
  META = JSON.parse(await window.__meshmetaPromise);
  THREE = await import(DEMO && new URLSearchParams(location.search).get("three") || THREE_URL);
  initMath(); initHandMath(); buildScene();
}

$("start").onclick = async () => {
  $("start").disabled = true;
  let stageName = "camera";
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      throw new Error("este navegador no permite que la página acceda a la cámara. Prueba con Chrome o Edge.");
    setStatus("Solicitando acceso a la cámara…");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    if (video.videoWidth && video.videoHeight) stage.style.setProperty("--ar", (video.videoWidth / video.videoHeight).toFixed(4));
    $("intro").hidden = true;
    stageName = "3D engine";
    setStatus("Cargando la anatomía 3D…");
    await boot();
    stageName = "trackers";
    setStatus("Cargando el seguimiento del rostro y las manos (la primera vez tarda unos segundos)…");
    await loadTrackers();
    if (!handTracker) $("L_hands").disabled = true;
    resize();
    liveLoop();
  } catch (err) {
    $("start").disabled = false; $("intro").hidden = false;
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    const msg = err && err.message ? err.message : String(err);
    setStatus(denied ? "Cámara bloqueada. Permite el acceso a la cámara para esta página y vuelve a hacer clic en Iniciar."
            : "No se pudo cargar " + stageName + ": " + msg, "bad");
  }
};

if (DEMO) boot().then(demoLoop).catch(e => setStatus("Error en la demostración: " + e.message, "bad"));
