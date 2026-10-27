/**
 * CatVTON Colab GPU Inference Service
 * Connects VÉSTARA to the official CatVTON diffusion pipeline running in Google Colab.
 * Repository: https://github.com/Zheng-Chong/CatVTON
 */

export interface CatVTONInferenceOptions {
  personBase64: string;
  garmentBase64: string;
  clothType?: "upper" | "lower" | "overall";
  numInferenceSteps?: number;
  guidanceScale?: number;
  seed?: number;
}

export interface CatVTONResult {
  resultImageUri: string;
  warning?: string;
  model: string;
}

/**
 * Maps standard wardrobe apparel category strings to CatVTON's required cloth types:
 * - "upper": tops, shirts, t-shirts, jackets, blazers, sweaters, coats, knits
 * - "lower": pants, trousers, jeans, chinos, skirts, shorts
 * - "overall": dresses, one-pieces, jumpsuits, suits, full ensembles
 */
export function categoryToClothType(
  category: string | null | undefined,
  description?: string | null,
): "upper" | "lower" | "overall" {
  const cat = (category || "").toLowerCase();
  const desc = (description || "").toLowerCase();

  // Check for dresses / overalls
  if (
    cat.includes("dress") ||
    cat.includes("one-piece") ||
    cat.includes("overall") ||
    cat.includes("jumpsuit") ||
    desc.includes("dress") ||
    desc.includes("jumpsuit")
  ) {
    return "overall";
  }

  // Check for lower garments
  if (
    cat.includes("bottom") ||
    cat.includes("pant") ||
    cat.includes("trouser") ||
    cat.includes("jean") ||
    cat.includes("chino") ||
    cat.includes("skirt") ||
    cat.includes("short") ||
    desc.includes("trousers") ||
    desc.includes("jeans") ||
    desc.includes("chinos")
  ) {
    return "lower";
  }

  // Default to upper (shirts, jackets, coats, knitwear, blazers)
  return "upper";
}

/**
 * Normalize Colab URL by trimming whitespace, removing trailing slashes,
 * and ensuring standard https:// prefix if missing.
 */
export function normalizeColabUrl(url: string | null | undefined): string {
  if (!url) return "";
  let trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Helper to convert arbitrary image responses from Gradio (data URI, remote URL, or file object)
 * into a standard data URI string.
 */
async function resolveGradioImageResult(
  rawImage: unknown,
  baseUrl: string,
): Promise<string | null> {
  if (!rawImage) return null;

  // Direct data URI
  if (typeof rawImage === "string") {
    if (rawImage.startsWith("data:image/")) {
      return rawImage;
    }
    // Remote absolute URL
    if (rawImage.startsWith("http://") || rawImage.startsWith("https://")) {
      try {
        const res = await fetch(rawImage, {
          headers: { "User-Agent": "VESTARA-CatVTON/1.0" },
        });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const mime = res.headers.get("content-type") || "image/png";
          const b64 = Buffer.from(ab).toString("base64");
          return `data:${mime};base64,${b64}`;
        }
      } catch (err) {
        console.warn("[CatVTON] Failed to download remote result image URL:", err);
      }
    }
    // Relative URL on the Gradio server (e.g. /file=... or /file/...)
    if (rawImage.startsWith("/")) {
      const fullUrl = `${baseUrl}${rawImage}`;
      try {
        const res = await fetch(fullUrl, {
          headers: { "User-Agent": "VESTARA-CatVTON/1.0" },
        });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const mime = res.headers.get("content-type") || "image/png";
          const b64 = Buffer.from(ab).toString("base64");
          return `data:${mime};base64,${b64}`;
        }
      } catch (err) {
        console.warn("[CatVTON] Failed to download relative result image URL:", err);
      }
    }
    // Raw base64 string
    if (rawImage.length > 100 && !rawImage.includes(" ") && !rawImage.includes("\n")) {
      return `data:image/png;base64,${rawImage}`;
    }
  }

  // Gradio object with { url, path } or { image: ... }
  if (typeof rawImage === "object" && rawImage !== null) {
    const obj = rawImage as Record<string, unknown>;
    if (obj.url && typeof obj.url === "string") {
      return resolveGradioImageResult(obj.url, baseUrl);
    }
    if (obj.path && typeof obj.path === "string") {
      const pathUrl = `${baseUrl}/file=${obj.path}`;
      return resolveGradioImageResult(pathUrl, baseUrl);
    }
    if (obj.image) {
      return resolveGradioImageResult(obj.image, baseUrl);
    }
  }

  return null;
}

/**
 * Tests the connection to the Google Colab CatVTON server.
 * Checks /health, /config, /info, and the root Gradio URL in sequence.
 */
export async function pingCatVTONServer(
  endpoint: string,
): Promise<{ ok: boolean; message: string; model?: string }> {
  const base = normalizeColabUrl(endpoint);
  if (!base || (!base.startsWith("http://") && !base.startsWith("https://"))) {
    return { ok: false, message: "Invalid URL. Please enter a valid URL beginning with https://" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const headers = {
      "User-Agent": "Mozilla/5.0 (VÉSTARA-CatVTON-Diagnostic)",
      Accept: "application/json, text/html, */*",
    };

    // 1. Try dedicated FastAPI /health endpoint from catvton_colab_server.py
    try {
      const healthRes = await fetch(`${base}/health`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      if (healthRes.ok) {
        clearTimeout(timeoutId);
        const json = await healthRes.json().catch(() => ({}));
        const gpuInfo = json.gpu_name ? ` (${json.gpu_name})` : "";
        return {
          ok: true,
          message: `CatVTON Colab GPU server connected and ready.${gpuInfo}`,
          model: json.model || "CatVTON (Diffusion Model)",
        };
      }
    } catch {
      // Continue to fallback checks
    }

    // 2. Try Gradio /config endpoint (built into all Gradio 3, 4, and 5 applications)
    try {
      const configRes = await fetch(`${base}/config`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      if (configRes.ok) {
        clearTimeout(timeoutId);
        const json = (await configRes.json().catch(() => ({}))) as {
          title?: string;
          version?: string;
        };
        const title = json.title || "CatVTON Inference Node";
        return {
          ok: true,
          message: `CatVTON Gradio application connected and ready (${title}).`,
          model: "CatVTON (Diffusion Model)",
        };
      }
    } catch {
      // Continue to info check
    }

    // 3. Try Gradio /info endpoint (Gradio 4+ API catalog)
    try {
      const infoRes = await fetch(`${base}/info`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      if (infoRes.ok) {
        clearTimeout(timeoutId);
        return {
          ok: true,
          message: "CatVTON Gradio API endpoint verified and ready.",
          model: "CatVTON (Diffusion Model)",
        };
      }
    } catch {
      // Continue to root check
    }

    // 4. Fallback: check if root URL responds
    const rootRes = await fetch(base, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (rootRes.ok || rootRes.status === 200 || rootRes.status === 302 || rootRes.status === 307) {
      return {
        ok: true,
        message: "CatVTON server reachable.",
        model: "CatVTON (Diffusion Model)",
      };
    }

    if (rootRes.status === 502 || rootRes.status === 503 || rootRes.status === 504) {
      return {
        ok: false,
        message: `Colab Gradio tunnel is offline (HTTP ${rootRes.status}). Please make sure your Google Colab notebook cell is actively running.`,
      };
    }

    if (rootRes.status === 404) {
      return {
        ok: false,
        message:
          "Gradio tunnel URL was not found (HTTP 404). Colab gradio.live links expire after restart. Please check your notebook output.",
      };
    }

    return {
      ok: false,
      message: `Server returned HTTP ${rootRes.status}. Make sure the Colab notebook is actively running.`,
    };
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      message: isTimeout
        ? "Connection timed out (10s). Verify that your Google Colab GPU instance is running and not asleep."
        : `Could not connect to Colab: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Sends person image and garment image to the CatVTON Colab inference server.
 * Supports:
 *  1. Direct REST endpoint (/api/tryon from catvton_colab_server.py)
 *  2. Gradio standard predict (/run/predict or /run/tryon or /api/predict)
 *  3. Gradio 4+ queue API (/call/tryon or /call/predict)
 */
export async function callCatVTONInference(
  endpoint: string,
  options: CatVTONInferenceOptions,
): Promise<CatVTONResult> {
  const base = normalizeColabUrl(endpoint);
  if (!base) {
    throw new Error("CatVTON Colab endpoint URL is not configured.");
  }

  const clothType = options.clothType || "upper";
  const numSteps = options.numInferenceSteps ?? 40;
  const guidanceScale = options.guidanceScale ?? 2.5;
  const seed = options.seed ?? 42;

  // Format images as data URIs
  const personDataUri = options.personBase64.startsWith("data:")
    ? options.personBase64
    : `data:image/jpeg;base64,${options.personBase64}`;

  const garmentDataUri = options.garmentBase64.startsWith("data:")
    ? options.garmentBase64
    : `data:image/jpeg;base64,${options.garmentBase64}`;

  const controller = new AbortController();
  // Allow up to 120 seconds for neural diffusion inference on Colab GPU
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  const requestHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (VÉSTARA-CatVTON-Inference)",
  };

  try {
    // STRATEGY 1: Dedicated REST endpoint (/api/tryon from catvton_colab_server.py)
    try {
      const restPayload = {
        person_image: personDataUri,
        garment_image: garmentDataUri,
        cloth_type: clothType,
        num_inference_steps: numSteps,
        guidance_scale: guidanceScale,
        seed: seed,
      };

      const restRes = await fetch(`${base}/api/tryon`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(restPayload),
        signal: controller.signal,
      });

      if (restRes.ok) {
        clearTimeout(timeoutId);
        const data = await restRes.json();
        if (data.status === "error" || data.error) {
          throw new Error(data.error || "CatVTON model failed to generate try-on output.");
        }
        const resolved = await resolveGradioImageResult(
          data.result_image || data.image || data.data?.[0],
          base,
        );
        if (resolved) {
          return {
            resultImageUri: resolved,
            model: data.model || "CatVTON (Diffusion Model)",
            warning: data.warning,
          };
        }
      } else if (restRes.status !== 404 && restRes.status !== 405) {
        // Real server error from REST route
        const errText = await restRes.text().catch(() => "");
        console.warn(`[CatVTON] REST endpoint returned status ${restRes.status}: ${errText.slice(0, 150)}`);
      }
    } catch (restErr) {
      if (restErr instanceof Error && restErr.name === "AbortError") {
        throw restErr;
      }
      console.warn("[CatVTON] REST endpoint attempt notice:", restErr);
    }

    // STRATEGY 2: Gradio standard /run/tryon or /run/predict endpoint
    const gradioEndpoints = ["/run/tryon", "/run/predict", "/api/predict"];
    for (const ep of gradioEndpoints) {
      try {
        const gradioPayload = {
          data: [personDataUri, garmentDataUri, clothType, numSteps, guidanceScale, seed],
        };

        const gRes = await fetch(`${base}${ep}`, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(gradioPayload),
          signal: controller.signal,
        });

        if (gRes.ok) {
          clearTimeout(timeoutId);
          const gData = await gRes.json();
          const rawResult = gData.data?.[0] || gData.result?.[0] || gData.image;
          const resolved = await resolveGradioImageResult(rawResult, base);
          if (resolved) {
            return {
              resultImageUri: resolved,
              model: "CatVTON (Diffusion Model)",
            };
          }
        }
      } catch (gErr) {
        if (gErr instanceof Error && gErr.name === "AbortError") throw gErr;
      }
    }

    // STRATEGY 3: Gradio 4+ Queue API (/call/tryon or /call/predict)
    const queueEndpoints = ["/call/tryon", "/call/predict", "/gradio_api/call/tryon"];
    for (const qep of queueEndpoints) {
      try {
        const queuePayload = {
          data: [personDataUri, garmentDataUri, clothType, numSteps, guidanceScale, seed],
        };

        const qRes = await fetch(`${base}${qep}`, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(queuePayload),
          signal: controller.signal,
        });

        if (qRes.ok) {
          const qData = (await qRes.json()) as { event_id?: string };
          if (qData.event_id) {
            // Stream or poll the event result
            const eventRes = await fetch(`${base}${qep}/${qData.event_id}`, {
              headers: { Accept: "text/event-stream", "User-Agent": "VESTARA-CatVTON/1.0" },
              signal: controller.signal,
            });
            if (eventRes.ok) {
              const text = await eventRes.text();
              // Parse SSE lines
              const lines = text.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const parsed = JSON.parse(line.slice(6));
                    const rawResult = Array.isArray(parsed) ? parsed[0] : parsed?.data?.[0];
                    const resolved = await resolveGradioImageResult(rawResult, base);
                    if (resolved) {
                      clearTimeout(timeoutId);
                      return {
                        resultImageUri: resolved,
                        model: "CatVTON (Diffusion Model)",
                      };
                    }
                  } catch {
                    // continue parsing lines
                  }
                }
              }
            }
          }
        }
      } catch (qErr) {
        if (qErr instanceof Error && qErr.name === "AbortError") throw qErr;
      }
    }

    clearTimeout(timeoutId);
    throw new Error(
      "Could not obtain try-on result from CatVTON server. Please ensure the Colab cell is running without errors.",
    );
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "CatVTON inference timed out after 120 seconds. The Google Colab GPU may be initializing or overloaded. Please retry.",
      );
    }
    throw err;
  }
}
