/**
 * Pose and body proportion analyzer for VÉSTARA Virtual Try-On.
 * Uses MediaPipe PoseLandmarker when available, with a resilient Canvas-based
 * vision fallback for offline / test / restricted environments.
 */

export interface PhotoValidationResult {
  valid: boolean;
  error?: string;
}

export interface PhotoQualityChecklist {
  fullBodyVisible: boolean;
  armsRelaxed: boolean;
  plainBackground: boolean;
  goodLighting: boolean;
}

export interface BodyProportions {
  heightScale: number; // 0.85 - 1.25 (overall height scaling)
  shoulderWidth: number; // 0.80 - 1.30 (shoulder span factor)
  torsoScale: number; // 0.85 - 1.25 (chest to hip length factor)
  legScale: number; // 0.85 - 1.25 (hip to foot length factor)
  skinTone: string; // Hex code e.g. #E8D5C4
  hairColor: string; // Hex code e.g. #2D231E
  isCropped: boolean; // True if knees/ankles are missing from the photo
  qualityChecklist: PhotoQualityChecklist;
  warning?: string;
}

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Validates the uploaded file format and size.
 */
export function validateTryOnPhoto(file: {
  type: string;
  size: number;
  name?: string;
}): PhotoValidationResult {
  if (!file) {
    return { valid: false, error: "Please select an image file to upload." };
  }

  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const hasValidExt =
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp");

  if (!ALLOWED_MIME_TYPES.includes(mime) && !hasValidExt) {
    return {
      valid: false,
      error: "Unsupported file type. Please upload a JPG, PNG, or WebP photo.",
    };
  }

  if (file.size > MAX_PHOTO_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeMb}MB). The maximum supported file size is 10MB.`,
    };
  }

  return { valid: true };
}

/**
 * Converts an RGB tuple to Hex string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Samples average color from a rectangular sub-region of an ImageData buffer.
 */
function sampleAverageColor(
  imgData: ImageData,
  relX: number,
  relY: number,
  relW: number,
  relH: number,
): { hex: string; r: number; g: number; b: number; luminance: number } {
  const width = imgData.width;
  const height = imgData.height;
  const data = imgData.data;

  const startX = Math.max(0, Math.min(width - 1, Math.floor(relX * width)));
  const startY = Math.max(0, Math.min(height - 1, Math.floor(relY * height)));
  const endX = Math.max(startX + 1, Math.min(width, Math.floor((relX + relW) * width)));
  const endY = Math.max(startY + 1, Math.min(height, Math.floor((relY + relH) * height)));

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3] ?? 0;
      if (alpha > 100) {
        totalR += data[idx] ?? 0;
        totalG += data[idx + 1] ?? 0;
        totalB += data[idx + 2] ?? 0;
        count++;
      }
    }
  }

  if (count === 0) {
    return { hex: "#E8D5C4", r: 232, g: 213, b: 196, luminance: 210 };
  }

  const r = totalR / count;
  const g = totalG / count;
  const b = totalB / count;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  return { hex: rgbToHex(r, g, b), r, g, b, luminance };
}

/**
 * Assesses whether the background perimeter has low variance (plain background).
 */
function assessPlainBackground(imgData: ImageData): boolean {
  const { width, height, data } = imgData;
  const samples: number[] = [];

  // Sample along perimeter (top, bottom, left, right edges)
  for (let x = 0; x < width; x += 10) {
    const topIdx = x * 4;
    samples.push((data[topIdx]! + data[topIdx + 1]! + data[topIdx + 2]!) / 3);
  }
  for (let y = 0; y < height; y += 10) {
    const leftIdx = y * width * 4;
    const rightIdx = (y * width + (width - 1)) * 4;
    samples.push((data[leftIdx]! + data[leftIdx + 1]! + data[leftIdx + 2]!) / 3);
    samples.push((data[rightIdx]! + data[rightIdx + 1]! + data[rightIdx + 2]!) / 3);
  }

  if (samples.length === 0) return true;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
  const stdDev = Math.sqrt(variance);

  // Standard deviation under 45 indicates a reasonably uniform plain background
  return stdDev < 45;
}

/**
 * Analyzes an Image Element or ImageBitmap to extract body landmarks, proportions,
 * skin tone, and hair color.
 */
export async function analyzePersonPhoto(
  imageSource: HTMLImageElement | ImageBitmap | ImageData,
): Promise<BodyProportions> {
  // Extract or render to canvas
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;

  if (typeof document !== "undefined") {
    canvas = document.createElement("canvas");
    let width = 480;
    let height = 640;

    if ("width" in imageSource && "height" in imageSource) {
      width = imageSource.width || 480;
      height = imageSource.height || 640;
    }
    // Downscale for fast browser processing
    const maxDim = 640;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    ctx = canvas.getContext("2d");
    if (ctx) {
      if ("data" in imageSource) {
        ctx.putImageData(imageSource, 0, 0);
      } else {
        ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);
      }
    }
  } else {
    // In SSR/Node test environment, return default proportions
    return getDefaultBodyProportions();
  }

  if (!ctx) return getDefaultBodyProportions();

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Color sampling
  // 1. Face region (Skin Tone) around upper-center: 42% - 58% x, 14% - 24% y
  const faceSample = sampleAverageColor(imgData, 0.44, 0.14, 0.12, 0.1);
  const skinTone = faceSample.hex;

  // 2. Hair region: top of head (43% - 57% x, 4% - 11% y)
  const hairSample = sampleAverageColor(imgData, 0.43, 0.05, 0.14, 0.08);
  const hairColor = hairSample.hex;

  // 3. Lighting check
  const centerSample = sampleAverageColor(imgData, 0.3, 0.2, 0.4, 0.5);
  const goodLighting = centerSample.luminance >= 50 && centerSample.luminance <= 235;

  // 4. Background check
  const plainBackground = assessPlainBackground(imgData);

  // Try MediaPipe PoseLandmarker if available in the browser window
  const landmarksResult = await runMediaPipePose(canvas);

  if (landmarksResult && landmarksResult.length >= 33) {
    const nose = landmarksResult[0]!;
    const leftShoulder = landmarksResult[11]!;
    const rightShoulder = landmarksResult[12]!;
    const leftWrist = landmarksResult[15]!;
    const rightWrist = landmarksResult[16]!;
    const leftHip = landmarksResult[23]!;
    const rightHip = landmarksResult[24]!;
    const leftKnee = landmarksResult[25]!;
    const rightKnee = landmarksResult[26]!;
    const leftAnkle = landmarksResult[27]!;
    const rightAnkle = landmarksResult[28]!;

    // Check visibility / presence of lower body (knees and ankles)
    const kneesVisible =
      (leftKnee.visibility ?? 1) > 0.5 ||
      (rightKnee.visibility ?? 1) > 0.5 ||
      (leftKnee.y < 0.95 && rightKnee.y < 0.95);
    const anklesVisible =
      (leftAnkle.visibility ?? 1) > 0.4 ||
      (rightAnkle.visibility ?? 1) > 0.4 ||
      (leftAnkle.y < 0.97 && rightAnkle.y < 0.97);

    const isCropped = !(kneesVisible && anklesVisible);

    // Shoulders width calculation (relative to image width)
    const shoulderSpan = Math.abs(rightShoulder.x - leftShoulder.x);
    // Baseline shoulder span in a typical portrait is ~0.26
    const shoulderWidth = Math.max(0.85, Math.min(1.28, shoulderSpan / 0.26));

    // Torso length calculation
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipMidY = (leftHip.y + rightHip.y) / 2;
    const torsoSpan = Math.abs(hipMidY - shoulderMidY);
    // Baseline torso span is ~0.28
    const torsoScale = Math.max(0.85, Math.min(1.25, torsoSpan / 0.28));

    // Legs calculation
    let legScale = 1.0;
    if (!isCropped) {
      const ankleMidY = (leftAnkle.y + rightAnkle.y) / 2;
      const legSpan = Math.abs(ankleMidY - hipMidY);
      // Baseline leg span is ~0.42
      legScale = Math.max(0.85, Math.min(1.25, legSpan / 0.42));
    } else {
      // Proportional estimate when cropped: lower body estimated from standard human proportions (1.5x torso)
      legScale = torsoScale * 0.98;
    }

    // Height scale
    const heightScale = Math.max(0.88, Math.min(1.2, torsoScale * 0.45 + legScale * 0.55));

    // Arms relaxed check (wrists generally level with or below hips)
    const armsRelaxed = leftWrist.y > leftHip.y - 0.12 && rightWrist.y > rightHip.y - 0.12;

    return {
      heightScale,
      shoulderWidth,
      torsoScale,
      legScale,
      skinTone,
      hairColor,
      isCropped,
      qualityChecklist: {
        fullBodyVisible: !isCropped,
        armsRelaxed,
        plainBackground,
        goodLighting,
      },
      warning: isCropped
        ? "Full-body photo not detected. Avatar proportions are estimated. Upload a full-length photo for better accuracy."
        : undefined,
    };
  }

  // Vision Fallback (Edge and silhouette density analysis)
  const fallbackSilhouette = analyzeSilhouetteFallback(imgData);

  return {
    heightScale: fallbackSilhouette.heightScale,
    shoulderWidth: fallbackSilhouette.shoulderWidth,
    torsoScale: fallbackSilhouette.torsoScale,
    legScale: fallbackSilhouette.legScale,
    skinTone,
    hairColor,
    isCropped: fallbackSilhouette.isCropped,
    qualityChecklist: {
      fullBodyVisible: !fallbackSilhouette.isCropped,
      armsRelaxed: true,
      plainBackground,
      goodLighting,
    },
    warning: fallbackSilhouette.isCropped
      ? "Full-body photo not detected. Avatar proportions are estimated. Upload a full-length photo for better accuracy."
      : undefined,
  };
}

/**
 * Fallback silhouette analysis when MediaPipe WASM is not present.
 */
function analyzeSilhouetteFallback(imgData: ImageData): {
  heightScale: number;
  shoulderWidth: number;
  torsoScale: number;
  legScale: number;
  isCropped: boolean;
} {
  const { width, height, data } = imgData;
  const rowDensities: number[] = new Array(height).fill(0);
  const bgLuminance = sampleAverageColor(imgData, 0.02, 0.02, 0.08, 0.08).luminance;

  for (let y = 0; y < height; y++) {
    let personPixels = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum =
        0.299 * (data[idx] ?? 0) + 0.587 * (data[idx + 1] ?? 0) + 0.114 * (data[idx + 2] ?? 0);
      if (Math.abs(lum - bgLuminance) > 28) {
        personPixels++;
      }
    }
    rowDensities[y] = personPixels / width;
  }

  // Check if subject reaches the bottom edge (cropped)
  const bottomDensity =
    (rowDensities[height - 1] ?? 0) +
    (rowDensities[height - 2] ?? 0) +
    (rowDensities[height - 3] ?? 0);
  const isCropped = bottomDensity / 3 > 0.12;

  // Find subject bounds
  let topY = 0;
  for (let y = 0; y < height; y++) {
    if ((rowDensities[y] ?? 0) > 0.08) {
      topY = y;
      break;
    }
  }

  let bottomY = height - 1;
  for (let y = height - 1; y >= 0; y--) {
    if ((rowDensities[y] ?? 0) > 0.08) {
      bottomY = y;
      break;
    }
  }

  const subjectHeightRel = (bottomY - topY) / height;

  // Find shoulder peak width (usually in top 20% - 35% of subject)
  const shoulderStart = topY + Math.floor((bottomY - topY) * 0.18);
  const shoulderEnd = topY + Math.floor((bottomY - topY) * 0.35);
  let maxShoulderDensity = 0.25;

  for (let y = shoulderStart; y <= shoulderEnd; y++) {
    if ((rowDensities[y] ?? 0) > maxShoulderDensity) {
      maxShoulderDensity = rowDensities[y] ?? 0;
    }
  }

  const shoulderWidth = Math.max(0.88, Math.min(1.22, maxShoulderDensity / 0.38));
  const heightScale = Math.max(0.9, Math.min(1.15, subjectHeightRel / 0.8));
  const torsoScale = Math.max(0.9, Math.min(1.18, shoulderWidth * 0.95));
  const legScale = isCropped ? torsoScale : heightScale;

  return {
    heightScale,
    shoulderWidth,
    torsoScale,
    legScale,
    isCropped,
  };
}

/**
 * Executes MediaPipe Pose Landmarker dynamically if loaded.
 */
async function runMediaPipePose(
  canvas: HTMLCanvasElement,
): Promise<Array<{ x: number; y: number; z?: number; visibility?: number }> | null> {
  if (typeof window === "undefined") return null;

  try {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );
    const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
    });

    const results = poseLandmarker.detect(canvas);
    poseLandmarker.close();

    if (results.landmarks && results.landmarks[0] && results.landmarks[0].length >= 33) {
      return results.landmarks[0];
    }
  } catch (err) {
    // MediaPipe unavailable or network restricted — fallback smoothly to vision analyzer
    console.info("MediaPipe Vision task unavailable, using silhouette analysis:", err);
  }

  return null;
}

export function getDefaultBodyProportions(): BodyProportions {
  return {
    heightScale: 1.0,
    shoulderWidth: 1.0,
    torsoScale: 1.0,
    legScale: 1.0,
    skinTone: "#E8D5C4",
    hairColor: "#2B2520",
    isCropped: false,
    qualityChecklist: {
      fullBodyVisible: true,
      armsRelaxed: true,
      plainBackground: true,
      goodLighting: true,
    },
  };
}
