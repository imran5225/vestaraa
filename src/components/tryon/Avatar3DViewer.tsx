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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Avatar3DProps {
  topColor?: string;
  bottomColor?: string;
  outerwearColor?: string;
  shoesColor?: string;
  hasOuterwear?: boolean;
  skinTone?: string;
  outfitPresetName?: string;
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
  skinTone = "#E8D5C4",
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
  } | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const outerwearMeshRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [autoRotate, setAutoRotate] = useState(false);
  const [activeTab, setActiveTab] = useState<"colors" | "layers">("colors");
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [activeColorTarget, setActiveColorTarget] = useState<
    "top" | "bottom" | "outerwear" | "shoes"
  >("top");

  // Track colors internally to support local overrides if no callback is supplied
  const [localTop, setLocalTop] = useState(topColor);
  const [localBottom, setLocalBottom] = useState(bottomColor);
  const [localOuterwear, setLocalOuterwear] = useState(outerwearColor);
  const [localShoes, setLocalShoes] = useState(shoesColor);
  const [localHasOuterwear, setLocalHasOuterwear] = useState(hasOuterwear);
  const [localSkin, setLocalSkin] = useState(skinTone);

  // Sync props when updated externally
  useEffect(() => setLocalTop(topColor), [topColor]);
  useEffect(() => setLocalBottom(bottomColor), [bottomColor]);
  useEffect(() => setLocalOuterwear(outerwearColor), [outerwearColor]);
  useEffect(() => setLocalShoes(shoesColor), [shoesColor]);
  useEffect(() => setLocalHasOuterwear(hasOuterwear), [hasOuterwear]);
  useEffect(() => setLocalSkin(skinTone), [skinTone]);

  // Update Three.js material colors without re-mounting the canvas
  useEffect(() => {
    if (!materialsRef.current) return;
    materialsRef.current.top.color.set(localTop);
    materialsRef.current.bottom.color.set(localBottom);
    materialsRef.current.outerwear.color.set(localOuterwear);
    materialsRef.current.shoes.color.set(localShoes);
    materialsRef.current.skin.color.set(localSkin);
    if (outerwearMeshRef.current) {
      outerwearMeshRef.current.visible = localHasOuterwear;
    }
  }, [localTop, localBottom, localOuterwear, localShoes, localHasOuterwear, localSkin]);

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
    // Limit polar angle so model stays upright and grounded
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.autoRotate = autoRotate;
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
    // PROCEDURAL STYLIZED 3D AVATAR MODEL (Group)
    // ==========================================
    const avatarGroup = new THREE.Group();

    // PBR Materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(localSkin),
      roughness: 0.55,
      metalness: 0.08,
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
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x222224,
      roughness: 0.3,
      metalness: 0.4,
    });

    materialsRef.current = {
      top: topMat,
      bottom: bottomMat,
      outerwear: outerwearMat,
      shoes: shoesMat,
      skin: skinMat,
    };

    // 1. HEAD & NECK
    const headGroup = new THREE.Group();
    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.14, 24);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.y = 1.48;
    headGroup.add(neckMesh);

    // Stylized Faceless Fashion Mannequin Head
    const headGeo = new THREE.SphereGeometry(0.125, 32, 28);
    headGeo.scale(0.85, 1.15, 0.95);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.set(0, 1.62, 0);
    headMesh.castShadow = !isSoftwareGl;
    headGroup.add(headMesh);
    avatarGroup.add(headGroup);

    // 2. TORSO / TOP GARMENT
    const torsoGroup = new THREE.Group();

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
    const armPositions = [-1, 1]; // Left and right

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

      // Forearm (skin or sleeve depending on fit)
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

    // Hips / Pelvis
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

      // Calf & Trouser Leg
      const calfGeo = new THREE.CylinderGeometry(0.066, 0.062, 0.38, 24);
      const calfMesh = new THREE.Mesh(calfGeo, bottomMat);
      calfMesh.position.set(legX, 0.29, 0);
      calfMesh.castShadow = !isSoftwareGl;
      bottomGroup.add(calfMesh);

      // Trouser Cuff
      const cuffGeo = new THREE.TorusGeometry(0.063, 0.012, 12, 24);
      cuffGeo.rotateX(Math.PI / 2);
      const cuffMesh = new THREE.Mesh(cuffGeo, bottomMat);
      cuffMesh.position.set(legX, 0.11, 0);
      bottomGroup.add(cuffMesh);
    });

    avatarGroup.add(bottomGroup);

    // 6. SHOES / FOOTWEAR
    const shoesGroup = new THREE.Group();
    armPositions.forEach((side) => {
      const footX = side * 0.095;

      // Shoe body
      const shoeGeo = new THREE.BoxGeometry(0.088, 0.08, 0.21);
      const shoeMesh = new THREE.Mesh(shoeGeo, shoesMat);
      shoeMesh.position.set(footX, 0.05, 0.03);
      shoeMesh.castShadow = !isSoftwareGl;
      shoesGroup.add(shoeMesh);

      // Shoe Sole
      const soleGeo = new THREE.BoxGeometry(0.092, 0.024, 0.22);
      const soleMesh = new THREE.Mesh(soleGeo, accentMat);
      soleMesh.position.set(footX, 0.012, 0.03);
      shoesGroup.add(soleMesh);
    });

    avatarGroup.add(shoesGroup);

    scene.add(avatarGroup);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
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

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();

      // Dispose geometries & materials
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

      {/* Top Floating Badges (Zero Occlusion) */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
          <span className="size-2 rounded-full bg-bronze" />
          3D Mannequin Visualizer
        </span>
        <span className="rounded-md bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
          Interactive Three.js Model · Drag to Rotate · Scroll to Zoom
        </span>
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

      {/* Unified Bottom Control Dock (Section 5 Three.js Directives) */}
      <div className="absolute bottom-3 left-1/2 z-10 w-[94%] max-w-xl -translate-x-1/2 transition-all duration-300">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-lift backdrop-blur-md">
          {/* Header Bar with Collapse Toggle */}
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
                  <span>Hide</span>
                  <ChevronDown className="size-3" />
                </>
              )}
            </Button>
          </div>

          {/* Collapsible Content */}
          {!controlsCollapsed && (
            <div className="p-3">
              {activeTab === "colors" ? (
                <div className="space-y-2.5">
                  {/* Part Selector */}
                  <div className="flex items-center gap-1 text-xs">
                    {(["top", "bottom", "outerwear", "shoes"] as const).map((part) => (
                      <button
                        key={part}
                        onClick={() => setActiveColorTarget(part)}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 capitalize transition-all",
                          activeColorTarget === part
                            ? "bg-secondary font-semibold text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {part}
                      </button>
                    ))}
                  </div>

                  {/* Swatches */}
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PALETTES[activeColorTarget].map((color) => {
                      const currentVal =
                        activeColorTarget === "top"
                          ? localTop
                          : activeColorTarget === "bottom"
                            ? localBottom
                            : activeColorTarget === "outerwear"
                              ? localOuterwear
                              : localShoes;
                      const isSelected = currentVal.toLowerCase() === color.hex.toLowerCase();
                      return (
                        <button
                          key={color.name}
                          onClick={() => selectColor(color.hex)}
                          title={`${color.name} (${color.hex})`}
                          className={cn(
                            "group relative size-6 rounded-full border border-border shadow-xs transition-transform hover:scale-110",
                            isSelected && "ring-2 ring-primary ring-offset-1",
                          )}
                          style={{ backgroundColor: color.hex }}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={localHasOuterwear}
                        onChange={(e) => setLocalHasOuterwear(e.target.checked)}
                        className="rounded"
                      />
                      <span>Outerwear Layer (Blazer / Coat)</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Mannequin Tone:</span>
                      <div className="flex gap-1">
                        {COLOR_PALETTES.skin.map((s) => (
                          <button
                            key={s.name}
                            onClick={() => setLocalSkin(s.hex)}
                            title={s.name}
                            className={cn(
                              "size-4 rounded-full border border-border",
                              localSkin === s.hex && "ring-1.5 ring-primary",
                            )}
                            style={{ backgroundColor: s.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preset Outfits */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground">Presets:</span>
                    {[
                      {
                        name: "Casual Denim",
                        top: "#FFFFFF",
                        bottom: "#22334F",
                        outer: "#1B2A4A",
                        hasOuter: false,
                        shoes: "#F5F5F7",
                      },
                      {
                        name: "Oxford & Chino",
                        top: "#7BA4C7",
                        bottom: "#D8C7B0",
                        outer: "#1B2A4A",
                        hasOuter: false,
                        shoes: "#633B22",
                      },
                      {
                        name: "Navy Blazer",
                        top: "#ECE4D8",
                        bottom: "#3B3D40",
                        outer: "#1B2A4A",
                        hasOuter: true,
                        shoes: "#1A1A1A",
                      },
                      {
                        name: "Camel Trench",
                        top: "#18181A",
                        bottom: "#1D1E20",
                        outer: "#B88E5E",
                        hasOuter: true,
                        shoes: "#633B22",
                      },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setLocalTop(preset.top);
                          setLocalBottom(preset.bottom);
                          setLocalOuterwear(preset.outer);
                          setLocalHasOuterwear(preset.hasOuter);
                          setLocalShoes(preset.shoes);
                        }}
                        className="rounded-full border bg-background/50 px-2 py-0.5 text-[11px] hover:bg-secondary"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ground Truth & Methodology Notice Bar */}
      <div className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-muted-foreground/75">
        Procedural Three.js 3D Fashion Mannequin
      </div>
    </div>
  );
}
