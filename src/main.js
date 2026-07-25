import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import {
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy,
  createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";
import { createLiquid } from "./canvasui/LiquidVanilla.ts";
import "./style.css";

// ───────────────────────────────────────────────────────────────────────────
// DAWN FIELD TERMINAL — 旭野テラ / ASAHINO TERRA
// Three.js + three-vrm viewer with a procedural idle and ion-cyan liquid overlay.
// ───────────────────────────────────────────────────────────────────────────

const MODEL_URL = `${import.meta.env.BASE_URL}models/asahino-tera.vrm`;

const canvas = document.querySelector("#vrm-canvas");
const app = document.querySelector("#app");
const liquidSource = document.querySelector("#liquid-source");
const liquidOutput = document.querySelector("#liquid-output");
const viewerShell = document.querySelector(".viewer-shell");
const viewerZone = document.querySelector(".viewer-zone");
const loadingPanel = document.querySelector("#loading");
const loadingValue = document.querySelector("#loading-value");
const loadingBar = document.querySelector("#loading-bar");
const errorPanel = document.querySelector("#error-panel");
const modelStatus = document.querySelector("#model-status");
const headerStatus = document.querySelector("#header-status");
const rotateButton = document.querySelector("#rotate-button");
const lightButton = document.querySelector("#light-button");
const frameButton = document.querySelector("#frame-button");
const resetButton = document.querySelector("#reset-button");
const fullscreenButton = document.querySelector("#fullscreen-button");
const motionButtons = [...document.querySelectorAll(".motion-trigger")];
const motionTabs = [...document.querySelectorAll("[data-motion-filter]")];
const motionPanels = [...document.querySelectorAll("[data-motion-panel]")];
const motionStatus = document.querySelector("#motion-status");
const motionStopButton = document.querySelector("#motion-stop");
const motionPauseButton = document.querySelector("#motion-pause");
const motionAutoButton = document.querySelector("#motion-auto");
const motionProgress = document.querySelector("#motion-progress");
const motionTime = document.querySelector("#motion-time");

const motions = {
  observe: { label: "観察 / OBSERVE", url: "./motions/01-observe.vrma", loop: true },
  accuse: { label: "告発 / ACCUSE", url: "./motions/02-accuse.vrma", loop: false },
  deny: { label: "弁明 / DENY", url: "./motions/03-deny.vrma", loop: false },
  victory: { label: "勝利 / VICTORY", url: "./motions/04-victory.vrma", loop: false },
  "idle-breathe": { label: "静かな呼吸 / BREATHE", url: "./motions/05-idle-breathe.vrma", loop: false },
  "idle-listen": { label: "気配を聴く / LISTEN", url: "./motions/06-idle-listen.vrma", loop: false },
  "idle-suspicion": { label: "疑念を読む / SUSPICION", url: "./motions/07-idle-suspicion.vrma", loop: false },
  "talk-calm": { label: "冷静な説明 / CALM", url: "./motions/08-talk-calm.vrma", loop: false },
  "talk-whisper": { label: "秘密の囁き / WHISPER", url: "./motions/09-talk-whisper.vrma", loop: false },
  "talk-press": { label: "核心を追及 / PRESS", url: "./motions/10-talk-press.vrma", loop: false },
};

// Bail gracefully if the shell needed to render is missing — the designer's
// index.html is the single source of the DOM contract.
if (!canvas || !app || !viewerShell) {
  console.error(
    "[asahino-tera] Missing required DOM node(s): #vrm-canvas, #app, or .viewer-shell. Viewer aborted.",
    { canvas, app, viewerShell },
  );
} else {
  startViewer();
}

function startViewer() {
  // ── Liquid overlay ──────────────────────────────────────────────────────
  // Ion-cyan fluid tuned for a bright solar page. Returns null when WebGL2 is
  // unavailable; the viewer keeps running, just without the fluid overlay.
  const liquid =
    liquidSource && liquidOutput && app
      ? createLiquid(
          { source: liquidSource, content: app, output: liquidOutput },
          {
            simResolution: 96,
            dyeResolution: 384,
            densityDissipation: 0.965,
            velocityDissipation: 0.985,
            pressureIterations: 4,
            curl: 2.2,
            radius: 0.2,
            force: 0.82,
            intensity: 2.4,
            distortion: 0.16,
            blend: 1.8,
            color: [0.094, 0.718, 0.710], // ion cyan #18B7B5
            rainbow: false,
          },
        )
      : null;
  if (!liquidSource || !liquidOutput) {
    console.error(
      "[asahino-tera] Liquid canvases (#liquid-source / #liquid-output) are missing; fluid overlay disabled.",
    );
  }

  // An opening flourish so the terminal feels alive on first paint.
  // Strengthened so the load pulse reads clearly on the bright ivory page.
  window.setTimeout(() => {
    liquid?.splat(0.52, 0.48, 28, -12);
    liquid?.splat(0.72, 0.32, -16, 14);
  }, 420);

  // ── Renderer / scene / camera ───────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  // Transparent clear so designer's sun-disc / orbital motifs behind #vrm-canvas
  // show through the model's negative space (alpha:true already implies this;
  // set explicitly so a three.js default change can't silently opacify it).
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 100);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minDistance = 1.3;
  controls.maxDistance = 6.2;
  controls.minPolarAngle = Math.PI * 0.22;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.75;

  // ── Lights: bright, sunlight-through-a-lens (NOT gothic) ─────────────────
  const keyLight = new THREE.DirectionalLight(0xffd9a0, 3.2); // warm solar key
  keyLight.position.set(2.8, 4.4, 3.4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8fd8d0, 2.0); // cyan-tinted fill
  fillLight.position.set(-3.2, 2.2, 2.6);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xff8a3d, 2.0); // orange rim
  rimLight.position.set(1.6, 2.8, -3.2);
  scene.add(rimLight);

  const ambient = new THREE.HemisphereLight(0xfff2d6, 0x16202a, 1.8);
  scene.add(ambient);

  // ── State ───────────────────────────────────────────────────────────────
  let currentVrm = null;
  let analysisMode = false;
  const displayRotation = 0.0; // default model facing; reset restores this
  const homePosition = new THREE.Vector3();
  const homeTarget = new THREE.Vector3();
  let currentFraming = "full";
  const motionLoader = new GLTFLoader();
  motionLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  const motionCache = new Map();
  let motionMixer = null;
  let activeMotionAction = null;
  let activeMotionId = null;
  let activeMotionAutomatic = false;
  let motionRequestId = 0;
  let randomAutoEnabled = true;
  let randomMotionTimer = null;
  let lastRandomMotionId = null;
  let motionsReady = false;

  // Procedural idle bone handles (captured once the VRM loads).
  let spineBone = null;
  let chestBone = null;
  let headBone = null;
  const spineRest = new THREE.Euler();
  const chestRest = new THREE.Euler();
  const headRest = new THREE.Euler();

  const timer = new THREE.Timer();
  timer.connect(document);
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  reducedMotionQuery.addEventListener("change", (event) => {
    reducedMotion = event.matches;
  });

  // ── Pose helpers ────────────────────────────────────────────────────────
  function setRelaxedPose(vrm) {
    const humanoid = vrm.humanoid;
    const leftUpperArm = humanoid?.getNormalizedBoneNode("leftUpperArm");
    const rightUpperArm = humanoid?.getNormalizedBoneNode("rightUpperArm");
    const leftLowerArm = humanoid?.getNormalizedBoneNode("leftLowerArm");
    const rightLowerArm = humanoid?.getNormalizedBoneNode("rightLowerArm");

    // Lower the VRoid T-pose into a relaxed field-observer silhouette.
    if (leftUpperArm) leftUpperArm.rotation.z = -1.08;
    if (rightUpperArm) rightUpperArm.rotation.z = 1.08;
    if (leftLowerArm) leftLowerArm.rotation.y = -0.12;
    if (rightLowerArm) rightLowerArm.rotation.y = 0.12;
  }

  function captureIdleBones(vrm) {
    const humanoid = vrm.humanoid;
    spineBone = humanoid?.getNormalizedBoneNode("spine") ?? null;
    chestBone = humanoid?.getNormalizedBoneNode("chest") ?? null;
    headBone = humanoid?.getNormalizedBoneNode("head") ?? null;
    if (spineBone) spineRest.copy(spineBone.rotation);
    if (chestBone) chestRest.copy(chestBone.rotation);
    if (headBone) headRest.copy(headBone.rotation);
  }

  // ── Yonagi Noa motion archive ─────────────────────────────────────────
  async function loadMotion(id) {
    if (motionCache.has(id)) return motionCache.get(id);
    const motion = motions[id];
    if (!motion) throw new Error(`Unknown motion: ${id}`);

    const gltf = await motionLoader.loadAsync(motion.url);
    const vrmAnimation = gltf.userData.vrmAnimations?.[0];
    if (!vrmAnimation) throw new Error(`VRMA data was not found: ${motion.url}`);
    motionCache.set(id, vrmAnimation);
    return vrmAnimation;
  }

  function setMotionButtonsEnabled(enabled) {
    motionButtons.forEach((button) => {
      button.disabled = !enabled;
    });
  }

  function selectMotionCategory(category, { focus = false } = {}) {
    motionTabs.forEach((tab) => {
      const selected = tab.dataset.motionFilter === category;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    motionPanels.forEach((panel) => {
      panel.hidden = panel.dataset.motionPanel !== category;
    });
  }

  function resetMotionPose() {
    motionMixer?.stopAllAction();
    activeMotionAction = null;
    if (!currentVrm) return;

    currentVrm.humanoid?.resetNormalizedPose();
    currentVrm.expressionManager?.resetValues();
    setRelaxedPose(currentVrm);
    currentVrm.update(0);
    captureIdleBones(currentVrm);
  }

  function clearRandomMotionTimer() {
    if (randomMotionTimer !== null) {
      window.clearTimeout(randomMotionTimer);
      randomMotionTimer = null;
    }
  }

  function syncRandomAutoButton() {
    if (!motionAutoButton) return;
    motionAutoButton.classList.toggle("active", randomAutoEnabled);
    motionAutoButton.setAttribute("aria-pressed", String(randomAutoEnabled));
    motionAutoButton.textContent = randomAutoEnabled ? "RANDOM AUTO · ON" : "RANDOM AUTO · OFF";
  }

  function pickRandomMotionId() {
    const ids = Object.keys(motions);
    const candidates = ids.filter((id) => id !== lastRandomMotionId);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function scheduleRandomMotion(delay = 900) {
    clearRandomMotionTimer();
    if (!randomAutoEnabled || !motionsReady || !currentVrm) return;
    randomMotionTimer = window.setTimeout(() => {
      randomMotionTimer = null;
      const id = pickRandomMotionId();
      lastRandomMotionId = id;
      playMotion(id, { automatic: true });
    }, delay);
  }

  function setRandomAuto(enabled, { immediate = false } = {}) {
    randomAutoEnabled = enabled;
    clearRandomMotionTimer();
    syncRandomAutoButton();

    if (!enabled) {
      activeMotionAutomatic = false;
      return;
    }

    if (immediate) {
      stopMotion({ announce: false, disableRandom: false });
      scheduleRandomMotion(0);
    } else if (!activeMotionAction) {
      scheduleRandomMotion();
    }
  }

  function updateMotionSelection(id, playing) {
    motionButtons.forEach((button) => {
      const selected = button.dataset.motion === id && playing;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function syncMotionTransport() {
    const duration = activeMotionAction?.getClip().duration ?? 0;
    const time = activeMotionAction?.time ?? 0;
    if (motionProgress) {
      motionProgress.value = duration > 0 ? String(Math.round((time / duration) * 1000)) : "0";
    }
    if (motionTime) motionTime.textContent = `${time.toFixed(2).padStart(5, "0")} / ${duration.toFixed(2).padStart(5, "0")}`;
    if (motionPauseButton && activeMotionAction) {
      motionPauseButton.textContent = activeMotionAction.paused ? "RESUME" : "PAUSE";
      motionPauseButton.setAttribute("aria-pressed", String(activeMotionAction.paused));
    }
  }

  function stopMotion({ announce = true, disableRandom = true } = {}) {
    clearRandomMotionTimer();
    if (disableRandom) {
      randomAutoEnabled = false;
      syncRandomAutoButton();
    }
    motionRequestId += 1;
    resetMotionPose();
    activeMotionId = null;
    activeMotionAutomatic = false;
    updateMotionSelection(null, false);
    if (motionStopButton) motionStopButton.disabled = true;
    if (motionPauseButton) motionPauseButton.disabled = true;
    if (motionProgress) {
      motionProgress.disabled = true;
      motionProgress.value = "0";
    }
    if (motionTime) motionTime.textContent = "00.00 / 00.00";

    if (announce && motionStatus) {
      motionStatus.textContent = "MOTION HALTED · SELECT A PROTOCOL";
      motionStatus.dataset.state = "ready";
    }
  }

  async function playMotion(id, { automatic = false } = {}) {
    if (!currentVrm || !motions[id]) return;

    clearRandomMotionTimer();
    const requestId = ++motionRequestId;
    const motion = motions[id];
    if (motionStatus) {
      motionStatus.textContent = `${automatic ? "RANDOM · " : ""}${motion.label} · LOADING`;
      motionStatus.dataset.state = "loading";
    }
    setMotionButtonsEnabled(false);

    try {
      const vrmAnimation = await loadMotion(id);
      if (requestId !== motionRequestId || !currentVrm) return;

      resetMotionPose();
      const clip = createVRMAnimationClip(vrmAnimation, currentVrm);
      motionMixer ??= new THREE.AnimationMixer(currentVrm.scene);
      const action = motionMixer.clipAction(clip);
      action.reset();
      const shouldLoop = motion.loop && !automatic;
      action.setLoop(shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce, shouldLoop ? Infinity : 1);
      action.clampWhenFinished = !shouldLoop;
      action.play();

      activeMotionAction = action;
      activeMotionId = id;
      activeMotionAutomatic = automatic;
      updateMotionSelection(id, true);
      if (motionStopButton) motionStopButton.disabled = false;
      if (motionPauseButton) motionPauseButton.disabled = false;
      if (motionProgress) motionProgress.disabled = false;
      if (motionStatus) {
        motionStatus.textContent = `${automatic ? "RANDOM · " : ""}${motion.label} · ${shouldLoop ? "LOOPING" : "PLAYING"}`;
        motionStatus.dataset.state = "playing";
      }
      syncMotionTransport();
      liquid?.splat(0.44, 0.56, shouldLoop ? 14 : 22, shouldLoop ? -8 : 7);
    } catch (error) {
      console.error("[asahino-tera] Failed to play VRMA motion:", error);
      stopMotion({ announce: false });
      if (motionStatus) {
        motionStatus.textContent = "MOTION SIGNAL ERROR";
        motionStatus.dataset.state = "error";
      }
    } finally {
      if (requestId === motionRequestId) setMotionButtonsEnabled(true);
    }
  }

  // ── Framing ─────────────────────────────────────────────────────────────
  // Two deliberate presets computed from the model's bounding box.
  const framingPresets = { full: { targetY: 0.95, distance: 3.2 }, portrait: { targetY: 1.35, distance: 1.7 } };

  function frameModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Center X/Z and drop the feet to y = 0 for predictable framing.
    model.position.x -= center.x;
    model.position.y -= box.min.y;
    model.position.z -= center.z;

    const fullTargetY = Math.max(0.95, size.y * 0.53);
    const fullDistance = Math.max(3.2, size.y * 1.95);
    const portraitTargetY = Math.max(1.35, size.y * 0.82);
    const portraitDistance = Math.max(1.6, size.y * 1.08);

    framingPresets.full = { targetY: fullTargetY, distance: fullDistance };
    framingPresets.portrait = { targetY: portraitTargetY, distance: portraitDistance };

    currentFraming = "full";
    controls.target.set(0, fullTargetY, 0);
    // Near-front, slightly raised, with headroom and foot margin.
    camera.position.set(0.08, fullTargetY + 0.08, fullDistance);
    homeTarget.copy(controls.target);
    homePosition.copy(camera.position);
    controls.update();
    syncFrameButton();
  }

  function applyFraming(name) {
    const preset = framingPresets[name] ?? framingPresets.full;
    currentFraming = name;
    // Preserve the user's current orbit direction; only retarget + redistance.
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
    direction.normalize();
    controls.target.set(0, preset.targetY, 0);
    camera.position.copy(controls.target).addScaledVector(direction, preset.distance);
    controls.update();
    syncFrameButton();
  }

  function syncFrameButton() {
    if (!frameButton) return;
    const portrait = currentFraming === "portrait";
    frameButton.setAttribute("aria-pressed", String(portrait));
    frameButton.classList.toggle("active", portrait);
  }

  // ── Loading UI ──────────────────────────────────────────────────────────
  function setLoading(progress) {
    if (!loadingValue || !loadingBar) return;
    const percentage = Math.min(99, Math.round(progress));
    loadingValue.textContent = `${percentage}%`;
    loadingBar.style.width = `${percentage}%`;
  }

  // ── VRM load ────────────────────────────────────────────────────────────
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  loader.load(
    MODEL_URL,
    (gltf) => {
      try {
        const vrm = gltf.userData.vrm;
        if (!vrm) throw new Error("VRM data was not found in the GLTF payload.");
        currentVrm = vrm;

        currentVrm.scene.traverse((object) => {
          object.frustumCulled = false;
        });

        setRelaxedPose(currentVrm);
        currentVrm.update(0);
        captureIdleBones(currentVrm);

        if (currentVrm.lookAt) {
          const lookAtProxy = new VRMLookAtQuaternionProxy(currentVrm.lookAt);
          lookAtProxy.name = "VRMLookAtQuaternionProxy";
          currentVrm.scene.add(lookAtProxy);
        }
        currentVrm.scene.rotation.y = displayRotation;
        scene.add(currentVrm.scene);
        frameModel(currentVrm.scene);

        if (loadingValue) loadingValue.textContent = "100%";
        if (loadingBar) loadingBar.style.width = "100%";
        if (modelStatus) modelStatus.textContent = "MODEL ONLINE";
        if (headerStatus) headerStatus.textContent = "SYNCHRONIZED";
        liquid?.splat(0.54, 0.52, 22, 4);
        motionMixer = new THREE.AnimationMixer(currentVrm.scene);
        motionMixer.addEventListener("finished", ({ action }) => {
          if (action !== activeMotionAction || !activeMotionId) return;
          const completedMotion = motions[activeMotionId];
          updateMotionSelection(activeMotionId, false);
          action.paused = true;
          if (activeMotionAutomatic && randomAutoEnabled) {
            activeMotionAction = null;
            activeMotionId = null;
            activeMotionAutomatic = false;
            if (motionPauseButton) motionPauseButton.disabled = true;
            if (motionProgress) motionProgress.disabled = true;
            if (motionStatus) {
              motionStatus.textContent = `${completedMotion.label} · RANDOM NEXT SIGNAL`;
              motionStatus.dataset.state = "ready";
            }
            scheduleRandomMotion();
            return;
          }
          if (motionPauseButton) {
            motionPauseButton.textContent = "REPLAY";
            motionPauseButton.disabled = false;
          }
          if (motionStatus) {
            motionStatus.textContent = `${completedMotion.label} · COMPLETE / REPLAY READY`;
            motionStatus.dataset.state = "complete";
          }
          syncMotionTransport();
        });

        Promise.all(Object.keys(motions).map((id) => loadMotion(id)))
          .then(() => {
            motionsReady = true;
            setMotionButtonsEnabled(true);
            if (motionStatus) {
              motionStatus.textContent = "10 MOTIONS READY · RANDOM AUTO START";
              motionStatus.dataset.state = "ready";
            }
            setRandomAuto(true, { immediate: true });
          })
          .catch((error) => {
            console.error("[asahino-tera] Failed to preload VRMA motions:", error);
            setMotionButtonsEnabled(true);
            if (motionStatus) {
              motionStatus.textContent = "MOTION PRELOAD PARTIAL · RETRY ON SELECT";
              motionStatus.dataset.state = "error";
            }
          });

        window.setTimeout(() => {
          if (loadingPanel) loadingPanel.hidden = true;
        }, 360);
      } catch (error) {
        handleLoadError(error);
      }
    },
    (event) => {
      if (event.total > 0) setLoading((event.loaded / event.total) * 100);
    },
    (error) => {
      handleLoadError(error);
    },
  );

  function handleLoadError(error) {
    console.error("[asahino-tera] Failed to load VRM model:", MODEL_URL, error);
    if (loadingPanel) loadingPanel.hidden = true;
    if (errorPanel) errorPanel.hidden = false;
    if (modelStatus) modelStatus.textContent = "MODEL ERROR";
    if (headerStatus) headerStatus.textContent = "SIGNAL LOST";
    if (motionStatus) motionStatus.textContent = "MOTION LINK UNAVAILABLE";
  }

  // ── Resize ──────────────────────────────────────────────────────────────
  function resize() {
    const width = viewerShell.clientWidth;
    const height = viewerShell.clientHeight;
    renderer.setSize(width, height, false);
    camera.fov = width <= 620 ? 35 : 27;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewerShell);
  resize();

  // ── Animate (procedural idle: breathing + tiny head sway) ───────────────
  function animate(timestamp) {
    timer.update(timestamp);
    const delta = timer.getDelta();
    const elapsed = timer.getElapsed();
    controls.update();

    if (currentVrm) {
      if (motionMixer && activeMotionAction) {
        if (!activeMotionAction.paused) motionMixer.update(delta);
        currentVrm.humanoid?.update();
        currentVrm.expressionManager?.update();
        syncMotionTransport();
      } else {
        const amp = reducedMotion ? 0 : 1;
        if (spineBone) {
          spineBone.rotation.x = spineRest.x + Math.sin(elapsed * 1.0) * 0.012 * amp;
          spineBone.rotation.z = spineRest.z + Math.sin(elapsed * 0.8) * 0.008 * amp;
        }
        if (chestBone) {
          chestBone.rotation.x = chestRest.x + Math.sin(elapsed * 1.0 + 0.4) * 0.01 * amp;
        }
        if (headBone) {
          headBone.rotation.y = headRest.y + Math.sin(elapsed * 0.5) * 0.028 * amp;
          headBone.rotation.x = headRest.x + Math.sin(elapsed * 0.65 + 1.0) * 0.012 * amp;
        }
        currentVrm.humanoid?.update();
      }
      currentVrm.update(delta);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  // ── Controls wiring ─────────────────────────────────────────────────────

  motionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setRandomAuto(false);
      playMotion(button.dataset.motion);
    });
  });

  motionTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectMotionCategory(tab.dataset.motionFilter));
    tab.addEventListener("keydown", (event) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + motionTabs.length) % motionTabs.length;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % motionTabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = motionTabs.length - 1;
      selectMotionCategory(motionTabs[nextIndex].dataset.motionFilter, { focus: true });
    });
  });

  motionStopButton?.addEventListener("click", () => stopMotion());
  motionAutoButton?.addEventListener("click", () => {
    setRandomAuto(!randomAutoEnabled, { immediate: !randomAutoEnabled });
  });
  motionPauseButton?.addEventListener("click", () => {
    if (!activeMotionAction || !activeMotionId) return;
    const duration = activeMotionAction.getClip().duration;
    if (activeMotionAction.paused && activeMotionAction.time >= duration - 0.02) {
      playMotion(activeMotionId, { automatic: activeMotionAutomatic });
      return;
    }
    activeMotionAction.paused = !activeMotionAction.paused;
    if (motionStatus) {
      motionStatus.textContent = `${motions[activeMotionId].label} · ${activeMotionAction.paused ? "PAUSED" : "PLAYING"}`;
      motionStatus.dataset.state = activeMotionAction.paused ? "paused" : "playing";
    }
    syncMotionTransport();
  });
  motionProgress?.addEventListener("input", () => {
    if (!activeMotionAction || !activeMotionId) return;
    activeMotionAction.paused = true;
    activeMotionAction.time = activeMotionAction.getClip().duration * (Number(motionProgress.value) / 1000);
    motionMixer?.update(0);
    currentVrm?.update(0);
    if (motionStatus) {
      motionStatus.textContent = `${motions[activeMotionId].label} · FRAME INSPECTION`;
      motionStatus.dataset.state = "paused";
    }
    syncMotionTransport();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeMotionId) stopMotion();
  });

  // AUTO ORBIT
  rotateButton?.addEventListener("click", () => {
    controls.autoRotate = !controls.autoRotate;
    rotateButton.classList.toggle("active", controls.autoRotate);
    rotateButton.setAttribute("aria-pressed", String(controls.autoRotate));
  });

  // SOLAR / ANALYSIS LIGHT
  lightButton?.addEventListener("click", () => {
    analysisMode = !analysisMode;
    renderer.toneMappingExposure = analysisMode ? 1.0 : 1.12;
    keyLight.color.set(analysisMode ? 0xb8eaff : 0xffd9a0);
    keyLight.intensity = analysisMode ? 2.4 : 3.2;
    fillLight.color.set(analysisMode ? 0x4fb8ff : 0x8fd8d0);
    fillLight.intensity = analysisMode ? 2.4 : 2.0;
    rimLight.intensity = analysisMode ? 1.4 : 2.0;
    liquid?.setOptions({
      color: analysisMode ? [0.04, 0.62, 0.92] : [0.094, 0.718, 0.71],
      intensity: analysisMode ? 2.0 : 1.7,
    });
    liquid?.splat(0.56, 0.44, analysisMode ? -22 : 20, analysisMode ? 10 : -8);
    lightButton.classList.toggle("active", analysisMode);
    lightButton.setAttribute("aria-pressed", String(analysisMode));
  });

  // FRAMING (FULL BODY ↔ PORTRAIT)
  frameButton?.addEventListener("click", () => {
    applyFraming(currentFraming === "full" ? "portrait" : "full");
  });

  // RESET CAMERA
  resetButton?.addEventListener("click", () => {
    stopMotion({ announce: false, disableRandom: false });
    currentFraming = "full";
    if (currentVrm) currentVrm.scene.rotation.y = displayRotation;
    camera.position.copy(homePosition);
    controls.target.copy(homeTarget);
    controls.autoRotate = false;
    if (rotateButton) {
      rotateButton.classList.toggle("active", false);
      rotateButton.setAttribute("aria-pressed", "false");
    }
    controls.update();
    syncFrameButton();
    if (motionStatus) {
      motionStatus.textContent = "VIEW RESET · RANDOM AUTO RESTART";
      motionStatus.dataset.state = "ready";
    }
    setRandomAuto(true, { immediate: true });
  });

  // FULLSCREEN
  fullscreenButton?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await viewerZone?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn("[asahino-tera] Fullscreen is unavailable:", error);
    }
  });

  document.addEventListener("fullscreenchange", resize);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  window.addEventListener(
    "pagehide",
    () => {
      clearRandomMotionTimer();
      timer.dispose();
      liquid?.destroy();
    },
    { once: true },
  );
}
