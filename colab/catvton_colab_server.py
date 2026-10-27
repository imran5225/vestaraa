"""
VÉSTARA x CatVTON Inference Server for Google Colab
===================================================
Official Model: https://github.com/Zheng-Chong/CatVTON
Paper: "Concatenation Is All You Need for Virtual Try-On with Diffusion Models"
Weights: zhengchong/CatVTON (Hugging Face)

This script initializes the official CatVTON pipeline with AutoMasker on a GPU,
and launches a dual interface:
1. REST API endpoint (/api/tryon) for VÉSTARA web integration
2. Public Gradio Web UI for manual testing & visual verification in Colab
"""

import os
import sys
import io
import time
import base64
import torch
import numpy as np
from PIL import Image
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import gradio as gr

# Ensure CatVTON repository path is in sys.path
sys.path.append(os.path.abspath("."))
sys.path.append("/content/CatVTON")

try:
    from model.cloth_masker import AutoMasker
    from model.pipeline import CatVTONPipeline
    from utils import resize_and_crop, resize_and_padding
except ImportError as e:
    print(f"Error importing CatVTON modules: {e}")
    print("Please make sure you have run: git clone https://github.com/Zheng-Chong/CatVTON.git and cd CatVTON")
    sys.exit(1)

# Device Configuration
device = "cuda" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

print(f"--> Initializing CatVTON on device: {device} ({torch_dtype})")
if torch.cuda.is_available():
    print(f"--> GPU: {torch.cuda.get_device_name(0)}")

# 1. Initialize AutoMasker
print("--> Loading AutoMasker (DensePose & SCHP)...")
try:
    automasker = AutoMasker(
        densepose_path="DensePose",
        schp_path="SCHP",
        device=device
    )
except Exception as e:
    print(f"Warning initializing default AutoMasker paths: {e}")
    # Fallback initialization if local paths are slightly different
    try:
        automasker = AutoMasker(device=device)
    except Exception as e2:
        print(f"AutoMasker warning: {e2}. Will use bounding fallbacks if needed.")
        automasker = None

# 2. Initialize CatVTON Pipeline with official Hugging Face weights
print("--> Loading official CatVTON Diffusion Pipeline (zhengchong/CatVTON)...")
pipeline = CatVTONPipeline(
    base_ckpt="zhengchong/CatVTON",
    attn_ckpt="zhengchong/CatVTON",
    attn_ckpt_version="mix",
    weight_dtype=torch_dtype,
    use_tf32=torch.cuda.is_available(),
    device=device
)
print("--> CatVTON Pipeline successfully loaded into GPU memory!")

def decode_base64_to_pil(base64_str: str) -> Image.Image:
    """Decodes data URI or raw base64 string to PIL Image in RGB format."""
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]
    img_data = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(img_data)).convert("RGB")
    return img

def encode_pil_to_base64(pil_img: Image.Image, format: str = "PNG") -> str:
    """Encodes PIL Image into a data URI base64 string."""
    buffered = io.BytesIO()
    pil_img.save(buffered, format=format, quality=95)
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    mime = "image/png" if format.upper() == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{img_str}"

def run_catvton_tryon(
    person_img: Image.Image,
    garment_img: Image.Image,
    cloth_type: str = "upper",
    num_steps: int = 40,
    guidance_scale: float = 2.5,
    seed: int = 42
) -> Image.Image:
    """
    Executes CatVTON inference on target person and garment images.
    cloth_type options: 'upper' | 'lower' | 'overall'
    """
    if cloth_type not in ["upper", "lower", "overall"]:
        cloth_type = "upper"

    target_size = (768, 1024)
    # Preprocess person image: resize & center-crop to 768x1024
    person_proc = resize_and_crop(person_img, target_size)
    # Preprocess garment image: resize & pad to 768x1024
    garment_proc = resize_and_padding(garment_img, target_size)

    # Generate garment mask
    mask = None
    if automasker is not None:
        try:
            mask_result = automasker(person_proc, cloth_type)
            if isinstance(mask_result, dict) and "mask" in mask_result:
                mask = mask_result["mask"]
            elif isinstance(mask_result, Image.Image):
                mask = mask_result
        except Exception as e:
            print(f"Automasker exception: {e}. Falling back to default region.")

    # Fallback mask if automasker fails or is unavailable
    if mask is None:
        w, h = target_size
        mask = Image.new("L", (w, h), 0)
        from PIL import ImageDraw
        draw = ImageDraw.Draw(mask)
        if cloth_type == "upper":
            draw.rectangle([int(w * 0.15), int(h * 0.18), int(w * 0.85), int(h * 0.60)], fill=255)
        elif cloth_type == "lower":
            draw.rectangle([int(w * 0.20), int(h * 0.52), int(w * 0.80), int(h * 0.95)], fill=255)
        else: # overall
            draw.rectangle([int(w * 0.15), int(h * 0.18), int(w * 0.85), int(h * 0.95)], fill=255)

    generator = torch.Generator(device=device).manual_seed(seed if seed >= 0 else int(time.time()))

    # Run diffusion pipeline
    results = pipeline(
        image=person_proc,
        condition_image=garment_proc,
        mask=mask,
        num_inference_steps=int(num_steps),
        guidance_scale=float(guidance_scale),
        generator=generator
    )

    result_img = results[0]
    return result_img

# Build Gradio UI
with gr.Blocks(title="VÉSTARA CatVTON Inference Node", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # VÉSTARA x CatVTON Inference Node
    **Official CatVTON Implementation** — *Concatenation Is All You Need for Virtual Try-On*
    - GPU: **{}**
    - Weights: `zhengchong/CatVTON`
    - Integration: Paste your public Gradio link (`https://xxxx.gradio.live`) into VÉSTARA Try-On Settings.
    """.format(torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"))

    with gr.Row():
        with gr.Column():
            person_input = gr.Image(type="pil", label="Person Image (Full Body)")
            garment_input = gr.Image(type="pil", label="Garment Image")
            cloth_type = gr.Radio(["upper", "lower", "overall"], value="upper", label="Garment Category")
            with gr.Accordion("Advanced Parameters", open=False):
                steps = gr.Slider(minimum=20, maximum=60, value=40, step=1, label="Inference Steps")
                guidance = gr.Slider(minimum=1.0, maximum=5.0, value=2.5, step=0.1, label="Guidance Scale")
                seed_val = gr.Number(value=42, label="Random Seed (-1 for random)")
            run_btn = gr.Button("Generate Try-On", variant="primary")
        
        with gr.Column():
            output_image = gr.Image(type="pil", label="CatVTON Try-On Result")

    run_btn.click(
        fn=run_catvton_tryon,
        inputs=[person_input, garment_input, cloth_type, steps, guidance, seed_val],
        outputs=[output_image],
        api_name="tryon"
    )

# Mount REST API route directly onto the FastAPI app backing Gradio
app: FastAPI = demo.app

# Enable CORS for cross-origin requests from VÉSTARA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model": "CatVTON (Official zhengchong/CatVTON)",
        "cuda": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "None",
        "timestamp": time.time()
    }

@app.post("/api/tryon")
async def api_tryon(request: Request):
    """
    Direct REST endpoint called by VÉSTARA backend.
    Accepts JSON with person_image, garment_image (data URI / base64), cloth_type, etc.
    """
    try:
        body = await request.json()
        person_b64 = body.get("person_image")
        garment_b64 = body.get("garment_image")
        cloth_type = body.get("cloth_type", "upper")
        num_steps = int(body.get("num_inference_steps", 40))
        guidance_scale = float(body.get("guidance_scale", 2.5))
        seed = int(body.get("seed", 42))

        if not person_b64:
            return JSONResponse(status_code=400, content={"status": "error", "error": "Missing person_image"})
        if not garment_b64:
            return JSONResponse(status_code=400, content={"status": "error", "error": "Missing garment_image"})

        t0 = time.time()
        person_pil = decode_base64_to_pil(person_b64)
        garment_pil = decode_base64_to_pil(garment_b64)

        result_pil = run_catvton_tryon(
            person_img=person_pil,
            garment_img=garment_pil,
            cloth_type=cloth_type,
            num_steps=num_steps,
            guidance_scale=guidance_scale,
            seed=seed
        )

        result_b64 = encode_pil_to_base64(result_pil, format="PNG")
        duration = round(time.time() - t0, 2)

        return {
            "status": "success",
            "result_image": result_b64,
            "cloth_type": cloth_type,
            "inference_time_seconds": duration,
            "model": "CatVTON (Diffusion Model)"
        }
    except Exception as err:
        print(f"[CatVTON API Error]: {err}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"status": "error", "error": str(err)}
        )

if __name__ == "__main__":
    print("\n=======================================================")
    print("🚀 Launching VÉSTARA x CatVTON Inference Server...")
    print("=======================================================\n")
    demo.queue().launch(
        share=True,
        server_name="0.0.0.0",
        server_port=7860,
        show_error=True
    )
