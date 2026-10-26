import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Palette,
  Layers,
  ChevronDown,
  ChevronUp,
  Download,
  Sparkles,
  AlertCircle,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BodyProportions } from "@/lib/pose-analyzer";

export interface Avatar3DProps {
  topColor?: string;
  bottomColor?: string;
  outerwearColor?: string;
  shoesColor?: string;
  hasOuterwear?: boolean;
  skinTone?: string;
  hairColor?: string;
  outfitPresetName?: string;
  proportions?: BodyProportions | null;
  hasUserPhoto?: boolean;
  onUploadPhotoPrompt?: () => void;
  onColorChange?: (part: "top" | "bottom" | "outerwear" | "shoes", color: string) => void;
  className?: string;
}

export const COLOR_PALETTES = {
  top: [
    { name: "Pure White", hex: "#FFFFFF" },
    { name: "Charcoal Grey", hex: "#3A3D40" },
    { name: "Oxford Blue", hex: "#7BA4C7" },
    { name: "Navy Blue", hex: "#1C2B42" },
    { name: "Champagne Cream", hex: "#ECE4D8" },
    { name: "Burgundy", hex: "#5C1D24" },
    { name: "Olive Sage", hex: "#5C6A53" },
    { name: "Black", hex: "#18181A" },
  ],
  bottom: [
    { name: "Indigo Denim", hex: "#22334F" },
    { name: "Beige Chino", hex: "#D8C7B0" },
    { name: "Black Tailored", hex: "#1D1E20" },
    { name: "Charcoal Wool", hex: "#3B3D40" },
    { name: "Stone Grey", hex: "#8E9196" },
    { name: "Olive Khaki", hex: "#4E5844" },
  ],
  outerwear: [
    { name: "Navy Blazer", hex: "#1B2A4A" },
    { name: "Camel Trench", hex: "#B88E5E" },
    { name: "Charcoal Wool", hex: "#2E3033" },
    { name: "Espresso Brown", hex: "#45332B" },
    { name: "Forest Green", hex: "#293D31" },
  ],
  shoes: [
    { name: "Crisp White", hex: "#F5F5F7" },
    { name: "Cognac Brown", hex: "#633B22" },
    { name: "Classic Black", hex: "#1A1A1A" },
    { name: "Tan Suede", hex: "#A87C53" },
  ],
  skin: [
    { name: "Warm Ivory", hex: "#E8D5C4" },
    { name: "Neutral Porcelain", hex: "#F3E7DC" },
    { name: "Golden Tan", hex: "#C69B7B" },
    { name: "Deep Bronze", hex: "#8A5A3C" },
    { name: "Obsidian Slate", hex: "#2B2D31" },
  ],
};

export function Avatar3DViewer({
  topColor = "#FFFFFF",
  bottomColor = "#22334F",
  outerwearColor = "#1B2A4A",
  shoesColor = "#F5F5F7",
  hasOuterwear = false,
  skinTone,
  hairColor,
  proportions,
  hasUserPhoto = false,
  onUploadPhotoPrompt,
  onColorChange,
  className,
}: Avatar3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const materialsRef = useRef<{
    top: THREE.MeshStandardMaterial;
    bottom: THREE.MeshStandardMaterial;
    outerwear: THREE.MeshStandardMaterial;
    shoes: THREE.MeshStandardMaterial;
    skin: THREE.MeshStandardMaterial;
    hair: THREE.MeshStandardMaterial;
  } | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const outerwearMeshRef = useRef<THREE.Group | null>(null);
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const torsoGroupRef = useRef<THREE.Group | null>(null);
  const bottomGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [autoRotate, setAutoRotate] = useState(false);
  const [activeTab, setActiveTab] = useState<"colors" | "layers">("colors");
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [activeColorTarget, setActiveColorTarget] = useState<
    "top" | "bottom" | "outerwear" | "shoes"
  >("top");

  // Determine skin tone and hair color from proportions or fallback props
  const effectiveSkin = proportions?.skinTone || skinTone || "#E8D5C4";
  const effectiveHair = proportions?.hairColor || hairColor || "#2B2520";

  // Track colors internally
  const [localTop, setLocalTop] = useState(topColor);
  const [localBottom, setLocalBottom] = useState(bottomColor);
  const [localOuterwear, setLocalOuterwear] = useState(outerwearColor);
  const [localShoes, setLocalShoes] = useState(shoesColor);
  const [localHasOuterwear, setLocalHasOuterwear] = useState(hasOuterwear);
  const [localSkin, setLocalSkin] = useState(effectiveSkin);
  const [localHair, setLocalHair] = useState(effectiveHair);

  // Sync props when updated externally
  useEffect(() => setLocalTop(topColor), [topColor]);
  useEffect(() => setLocalBottom(bottomColor), [bottomColor]);
  useEffect(() => setLocalOuterwear(outerwearColor), [outerwearColor]);
  useEffect(() => setLocalShoes(shoesColor), [shoesColor]);
  useEffect(() => setLocalHasOuterwear(hasOuterwear), [hasOuterwear]);
  useEffect(() => setLocalSkin(effectiveSkin), [effectiveSkin]);
  useEffect(() => setLocalHair(effectiveHair), [effectiveHair]);

  // Update Three.js material colors without re-mounting the canvas
  useEffect(() => {
    if (!materialsRef.current) return;
    materialsRef.current.top.color.set(localTop);
    materialsRef.current.bottom.color.set(localBottom);
    materialsRef.current.outerwear.color.set(localOuterwear);
    materialsRef.current.shoes.color.set(localShoes);
    materialsRef.current.skin.color.set(localSkin);
    materialsRef.current.hair.color.set(localHair);
    if (outerwearMeshRef.current) {
      outerwearMeshRef.current.visible = localHasOuterwear;
    }
  }, [localTop, localBottom, localOuterwear, localShoes, localHasOuterwear, localSkin, localHair]);

  // Dynamic proportion scaling when photo analysis changes
  useEffect(() => {
    if (!avatarGroupRef.current) return;
    const p = proportions;
    const heightScale = p?.heightScale ?? 1.0;
    const shoulderWidth = p?.shoulderWidth ?? 1.0;
    const torsoScale = p?.torsoScale ?? 1.0;
    const legScale = p?.legScale ?? 1.0;

    // Apply scale adjustments
    avatarGroupRef.current.scale.set(shoulderWidth, heightScale, (shoulderWidth + 1) / 2);

    if (torsoGroupRef.current) {
      torsoGroupRef.current.scale.set(shoulderWidth, torsoScale, 1.0);
    }
    if (bottomGroupRef.current) {
      bottomGroupRef.current.scale.set(1.0, legScale, 1.0);
    }
  }, [proportions]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Three.js Mount Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 560;

    // Detect software WebGL
    const isSoftwareGl = (() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      if (!gl) return true;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 1.1, 2.9);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.95, 0);
    controls.minDistance = 1.6;
    controls.maxDistance = 4.2;
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.2;
    controlsRef.current = controls;

    // Procedural Studio Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Studio Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.8);
    keyLight.position.set(2.5, 3.5, 3.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 10;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0xffffff, 0xd0c4b8, 0.8);
    fillLight.position.set(0, 3, 0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xe8eef8, 1.2);
    rimLight.position.set(-2.5, 2.5, -2.5);
    scene.add(rimLight);

    // Ground Contact Shadow
    const groundGeo = new THREE.PlaneGeometry(2.2, 2.2);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 128, 15, 128, 128, 120);
      grad.addColorStop(0, "rgba(20, 20, 24, 0.42)");
      grad.addColorStop(0.5, "rgba(20, 20, 24, 0.15)");
      grad.addColorStop(1, "rgba(20, 20, 24, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const shadowTex = new THREE.CanvasTexture(canvas);
    shadowTex.colorSpace = THREE.SRGBColorSpace;
    const groundMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0.002;
    scene.add(groundMesh);

    // Circular pedestal ring
    const ringGeo = new THREE.RingGeometry(0.75, 0.765, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xc8b69b,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.004;
    scene.add(ringMesh);

    // ==========================================
    // PROCEDURAL PERSONALIZED 3D AVATAR MODEL
    // ==========================================
    const avatarGroup = new THREE.Group();
    avatarGroupRef.current = avatarGroup;

    // PBR Materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(localSkin),
      roughness: 0.55,
      metalness: 0.08,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(localHair),
      roughness: 0.85,
      metalness: 0.04,
    });
    const topMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(localTop),
      roughness: 0.72,
      metalness: 0.02,
    });
    const bottomMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(localBottom),
      roughness: 0.68,
      metalness: 0.05,
    });
    const outerwearMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(localOuterwear),
      roughness: 0.58,
      metalness: 0.1,
    });
    const shoesMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(localShoes),
      roughness: 0.45,
      metalness: 0.12,
    });

    materialsRef.current = {
      top: topMat,
      bottom: bottomMat,
      outerwear: outerwearMat,
      shoes: shoesMat,
      skin: skinMat,
      hair: hairMat,
    };

    // 1. HEAD & HAIR
    const headGroup = new THREE.Group();
    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.14, 24);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.y = 1.48;
    headGroup.add(neckMesh);

    // Head
    const headGeo = new THREE.SphereGeometry(0.125, 32, 28);
    headGeo.scale(0.85, 1.15, 0.95);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.set(0, 1.62, 0);
    headMesh.castShadow = !isSoftwareGl;
    headGroup.add(headMesh);

    // Hair Cap / Geometry (styled to match sampled hair color)
    const hairGeo = new THREE.SphereGeometry(0.13, 24, 20);
    hairGeo.scale(0.88, 0.95, 0.98);
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.set(0, 1.66, -0.02);
    headGroup.add(hairMesh);

    avatarGroup.add(headGroup);

    // 2. TORSO / TOP GARMENT
    const torsoGroup = new THREE.Group();
    torsoGroupRef.current = torsoGroup;

    // Upper Torso / Chest
    const chestGeo = new THREE.CylinderGeometry(0.2, 0.165, 0.28, 28);
    const chestMesh = new THREE.Mesh(chestGeo, topMat);
    chestMesh.position.set(0, 1.3, 0);
    chestMesh.castShadow = !isSoftwareGl;
    torsoGroup.add(chestMesh);

    // Lower Torso / Waist
    const waistGeo = new THREE.CylinderGeometry(0.165, 0.175, 0.22, 28);
    const waistMesh = new THREE.Mesh(waistGeo, topMat);
    waistMesh.position.set(0, 1.08, 0);
    waistMesh.castShadow = !isSoftwareGl;
    torsoGroup.add(waistMesh);

    // Collar detail
    const collarGeo = new THREE.TorusGeometry(0.09, 0.02, 16, 28);
    collarGeo.rotateX(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeo, topMat);
    collarMesh.position.set(0, 1.43, 0);
    torsoGroup.add(collarMesh);

    avatarGroup.add(torsoGroup);

    // 3. ARMS & HANDS
    const armsGroup = new THREE.Group();
    const armPositions = [-1, 1];

    armPositions.forEach((side) => {
      // Shoulder
      const shoulderGeo = new THREE.SphereGeometry(0.065, 20, 20);
      const shoulderMesh = new THREE.Mesh(shoulderGeo, topMat);
      shoulderMesh.position.set(side * 0.23, 1.38, 0);
      armsGroup.add(shoulderMesh);

      // Upper Arm
      const upperArmGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.24, 20);
      const upperArmMesh = new THREE.Mesh(upperArmGeo, topMat);
      upperArmMesh.position.set(side * 0.24, 1.24, 0);
      upperArmMesh.rotation.z = -side * 0.12;
      upperArmMesh.castShadow = !isSoftwareGl;
      armsGroup.add(upperArmMesh);

      // Forearm
      const forearmGeo = new THREE.CylinderGeometry(0.043, 0.038, 0.24, 20);
      const forearmMesh = new THREE.Mesh(forearmGeo, skinMat);
      forearmMesh.position.set(side * 0.265, 1.02, 0.03);
      forearmMesh.rotation.z = -side * 0.08;
      forearmMesh.rotation.x = -0.15;
      forearmMesh.castShadow = !isSoftwareGl;
      armsGroup.add(forearmMesh);

      // Hand
      const handGeo = new THREE.BoxGeometry(0.04, 0.08, 0.025);
      const handMesh = new THREE.Mesh(handGeo, skinMat);
      handMesh.position.set(side * 0.28, 0.88, 0.06);
      handMesh.rotation.z = -side * 0.1;
      armsGroup.add(handMesh);
    });

    avatarGroup.add(armsGroup);

    // 4. OUTERWEAR LAYER (Overcoat / Blazer)
    const outerwearGroup = new THREE.Group();
    outerwearMeshRef.current = outerwearGroup;

    // Coat Body
    const coatBodyGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.54, 28);
    const coatBodyMesh = new THREE.Mesh(coatBodyGeo, outerwearMat);
    coatBodyMesh.position.set(0, 1.16, 0);
    coatBodyMesh.castShadow = !isSoftwareGl;
    outerwearGroup.add(coatBodyMesh);

    // Coat Lapels
    const lapelLeftGeo = new THREE.BoxGeometry(0.05, 0.32, 0.03);
    const lapelLeft = new THREE.Mesh(lapelLeftGeo, outerwearMat);
    lapelLeft.position.set(-0.08, 1.26, 0.165);
    lapelLeft.rotation.z = -0.15;
    outerwearGroup.add(lapelLeft);

    const lapelRightGeo = new THREE.BoxGeometry(0.05, 0.32, 0.03);
    const lapelRight = new THREE.Mesh(lapelRightGeo, outerwearMat);
    lapelRight.position.set(0.08, 1.26, 0.165);
    lapelRight.rotation.z = 0.15;
    outerwearGroup.add(lapelRight);

    // Coat Sleeves
    armPositions.forEach((side) => {
      const coatSleeveGeo = new THREE.CylinderGeometry(0.062, 0.056, 0.26, 20);
      const coatSleeveMesh = new THREE.Mesh(coatSleeveGeo, outerwearMat);
      coatSleeveMesh.position.set(side * 0.245, 1.23, 0);
      coatSleeveMesh.rotation.z = -side * 0.12;
      coatSleeveMesh.castShadow = !isSoftwareGl;
      outerwearGroup.add(coatSleeveMesh);
    });

    outerwearGroup.visible = localHasOuterwear;
    avatarGroup.add(outerwearGroup);

    // 5. BOTTOM / TROUSERS & LEGS
    const bottomGroup = new THREE.Group();
    bottomGroupRef.current = bottomGroup;

    // Pelvis
    const pelvisGeo = new THREE.CylinderGeometry(0.18, 0.19, 0.16, 28);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, bottomMat);
    pelvisMesh.position.set(0, 0.92, 0);
    pelvisMesh.castShadow = !isSoftwareGl;
    bottomGroup.add(pelvisMesh);

    // Legs
    armPositions.forEach((side) => {
      const legX = side * 0.095;

      // Thigh
      const thighGeo = new THREE.CylinderGeometry(0.082, 0.068, 0.4, 24);
      const thighMesh = new THREE.Mesh(thighGeo, bottomMat);
      thighMesh.position.set(legX, 0.68, 0);
      thighMesh.castShadow = !isSoftwareGl;
      bottomGroup.add(thighMesh);

      // Knee Joint
      const kneeGeo = new THREE.SphereGeometry(0.068, 18, 18);
      const kneeMesh = new THREE.Mesh(kneeGeo, bottomMat);
      kneeMesh.position.set(legX, 0.48, 0);
      bottomGroup.add(kneeMesh);

      // Calf / Shin
      const calfGeo = new THREE.CylinderGeometry(0.068, 0.052, 0.42, 24);
      const calfMesh = new THREE.Mesh(calfGeo, bottomMat);
      calfMesh.position.set(legX, 0.26, 0);
      calfMesh.castShadow = !isSoftwareGl;
      bottomGroup.add(calfMesh);

      // Ankle
      const ankleGeo = new THREE.CylinderGeometry(0.048, 0.045, 0.06, 20);
      const ankleMesh = new THREE.Mesh(ankleGeo, bottomMat);
      ankleMesh.position.set(legX, 0.06, 0);
      bottomGroup.add(ankleMesh);

      // Shoes / Footwear
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(legX, 0.03, 0.02);

      const shoeBodyGeo = new THREE.BoxGeometry(0.09, 0.06, 0.19);
      const shoeBodyMesh = new THREE.Mesh(shoeBodyGeo, shoesMat);
      shoeBodyMesh.position.set(0, 0, 0.02);
      shoeBodyMesh.castShadow = !isSoftwareGl;
      shoeGroup.add(shoeBodyMesh);

      // Shoe Sole
      const soleGeo = new THREE.BoxGeometry(0.094, 0.018, 0.2);
      const soleMat = new THREE.MeshStandardMaterial({
        color: 0x222224,
        roughness: 0.4,
      });
      const soleMesh = new THREE.Mesh(soleGeo, soleMat);
      soleMesh.position.set(0, -0.026, 0.02);
      shoeGroup.add(soleMesh);

      bottomGroup.add(shoeGroup);
    });

    avatarGroup.add(bottomGroup);
    scene.add(avatarGroup);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 400;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();

      avatarGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      groundGeo.dispose();
      groundMat.dispose();
      shadowTex.dispose();
      ringGeo.dispose();
      ringMat.dispose();

      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleResetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 1.1, 2.9);
    controlsRef.current.target.set(0, 0.95, 0);
    controlsRef.current.update();
  }, []);

  const handleZoom = useCallback((delta: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    cam.position.addScaledVector(dir, delta);
    controlsRef.current.update();
  }, []);

  const handleDownloadSnapshot = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "vestara-3d-avatar.png";
    a.click();
  }, []);

  const selectColor = (hex: string) => {
    if (activeColorTarget === "top") {
      setLocalTop(hex);
      onColorChange?.("top", hex);
    } else if (activeColorTarget === "bottom") {
      setLocalBottom(hex);
      onColorChange?.("bottom", hex);
    } else if (activeColorTarget === "outerwear") {
      setLocalOuterwear(hex);
      onColorChange?.("outerwear", hex);
    } else if (activeColorTarget === "shoes") {
      setLocalShoes(hex);
      onColorChange?.("shoes", hex);
    }
  };

  return (
    <div
      className={cn(
        "relative flex h-[580px] w-full flex-col overflow-hidden rounded-3xl border bg-gradient-to-b from-surface/80 to-card",
        className,
      )}
    >
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Top Status & Proportions Banner */}
      <div className="pointer-events-none absolute left-4 top-4 flex max-w-sm flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
          <span className={cn("size-2 rounded-full", hasUserPhoto ? "bg-success" : "bg-bronze")} />
          {hasUserPhoto ? "Personalized 3D Avatar" : "Default 3D Mannequin"}
        </span>

        {!hasUserPhoto && onUploadPhotoPrompt && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-bronze/30 bg-background/95 p-2 text-xs text-foreground shadow-sm backdrop-blur-sm">
            <Sparkles className="size-3.5 shrink-0 text-bronze" />
            <span className="text-[11px]">Upload a photo to personalize your avatar.</span>
            <Button
              size="sm"
              variant="quiet"
              className="h-6 px-2 text-[10px]"
              onClick={onUploadPhotoPrompt}
            >
              <Upload className="mr-1 size-3" /> Upload
            </Button>
          </div>
        )}

        {hasUserPhoto && proportions?.warning && (
          <div className="pointer-events-auto flex items-start gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-900 dark:text-amber-200 shadow-sm backdrop-blur-sm">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{proportions.warning}</span>
          </div>
        )}

        {hasUserPhoto && !proportions?.warning && (
          <span className="rounded-md bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
            Proportions, skin tone & hair matched from photo
          </span>
        )}
      </div>

      {/* Floating View Controls (Top Right) */}
      <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-background/90 p-1 shadow-sm backdrop-blur-sm">
        <Button
          size="icon"
          variant="ghost"
          className="size-8 rounded-full"
          title="Zoom In"
          onClick={() => handleZoom(0.3)}
        >
          <ZoomIn className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 rounded-full"
          title="Zoom Out"
          onClick={() => handleZoom(-0.3)}
        >
          <ZoomOut className="size-4" />
        </Button>
        <Button
          size="icon"
          variant={autoRotate ? "champagne" : "ghost"}
          className="size-8 rounded-full"
          title="Toggle Auto-Rotation"
          onClick={() => setAutoRotate((prev) => !prev)}
        >
          <RotateCw className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 rounded-full"
          title="Reset View"
          onClick={handleResetCamera}
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 rounded-full"
          title="Download 3D Snapshot"
          onClick={handleDownloadSnapshot}
        >
          <Download className="size-4" />
        </Button>
      </div>

      {/* Bottom Control Dock */}
      <div className="absolute bottom-3 left-1/2 z-10 w-[94%] max-w-xl -translate-x-1/2 transition-all duration-300">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-lift backdrop-blur-md">
          <div className="flex items-center justify-between border-b px-4 py-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveTab("colors");
                  setControlsCollapsed(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors",
                  activeTab === "colors" && !controlsCollapsed
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Palette className="size-3.5" /> Garment Colors
              </button>
              <button
                onClick={() => {
                  setActiveTab("layers");
                  setControlsCollapsed(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors",
                  activeTab === "layers" && !controlsCollapsed
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Layers className="size-3.5" /> Garments & Layers
              </button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
              onClick={() => setControlsCollapsed((prev) => !prev)}
            >
              {controlsCollapsed ? (
                <>
                  <span>Show Dock</span>
                  <ChevronUp className="size-3" />
                </>
              ) : (
                <>
                  <span>Minimize</span>
                  <ChevronDown className="size-3" />
                </>
              )}
            </Button>
          </div>

          {!controlsCollapsed && (
            <div className="p-3 text-xs">
              {activeTab === "colors" ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">
                      Select Garment Target:
                    </span>
                    <div className="flex gap-1">
                      {(["top", "bottom", "outerwear", "shoes"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setActiveColorTarget(t)}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] capitalize transition-colors",
                            activeColorTarget === t
                              ? "bg-secondary font-medium text-secondary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {COLOR_PALETTES[activeColorTarget].map((c) => (
                      <button
                        key={c.name}
                        title={c.name}
                        onClick={() => selectColor(c.hex)}
                        style={{ backgroundColor: c.hex }}
                        className={cn(
                          "size-6 rounded-full border border-border shadow-sm transition-transform hover:scale-110",
                          (activeColorTarget === "top" && localTop === c.hex) ||
                            (activeColorTarget === "bottom" && localBottom === c.hex) ||
                            (activeColorTarget === "outerwear" && localOuterwear === c.hex) ||
                            (activeColorTarget === "shoes" && localShoes === c.hex)
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "",
                        )}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const next = !localHasOuterwear;
                        setLocalHasOuterwear(next);
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        localHasOuterwear
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {localHasOuterwear ? "Outerwear: Layered (On)" : "Outerwear: Hidden (Off)"}
                    </button>
                    <span className="text-[11px] text-muted-foreground">
                      Toggle jacket, trench or blazer overlay
                    </span>
                  </div>
                  {proportions && (
                    <div className="text-[11px] text-muted-foreground">
                      Height: {proportions.heightScale.toFixed(2)}x · Shoulders:{" "}
                      {proportions.shoulderWidth.toFixed(2)}x
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
