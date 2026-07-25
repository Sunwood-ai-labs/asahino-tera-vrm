import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
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

  // Procedural idle bone handles (captured once the VRM loads).
  let spineBone = null;
  let chestBone = null;
  let headBone = null;
  const spineRest = new THREE.Euler();
  const chestRest = new THREE.Euler();
  const headRest = new THREE.Euler();

  const clock = new THREE.Clock();
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

    // Subtle upper-arm z-rotation so the silhouette is not a stiff A-pose.
    if (leftUpperArm) leftUpperArm.rotation.z = -0.42;
    if (rightUpperArm) rightUpperArm.rotation.z = 0.42;
    if (leftLowerArm) leftLowerArm.rotation.y = -0.08;
    if (rightLowerArm) rightLowerArm.rotation.y = 0.08;
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
          currentVrm.lookAt.target = camera;
        }
        currentVrm.scene.rotation.y = displayRotation;
        scene.add(currentVrm.scene);
        frameModel(currentVrm.scene);

        if (loadingValue) loadingValue.textContent = "100%";
        if (loadingBar) loadingBar.style.width = "100%";
        if (modelStatus) modelStatus.textContent = "MODEL ONLINE";
        if (headerStatus) headerStatus.textContent = "SYNCHRONIZED";
        liquid?.splat(0.54, 0.52, 22, 4);

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
  function animate() {
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    controls.update();

    if (currentVrm) {
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
      currentVrm.update(delta);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  // ── Controls wiring ─────────────────────────────────────────────────────

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
      liquid?.destroy();
    },
    { once: true },
  );
}
