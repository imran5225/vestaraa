# VÉSTARA x CatVTON Google Colab Integration

This folder contains the complete Google Colab GPU inference environment for integrating **CatVTON** (_Concatenation Is All You Need for Virtual Try-On with Diffusion Models_) into VÉSTARA.

Official Repository: [https://github.com/Zheng-Chong/CatVTON](https://github.com/Zheng-Chong/CatVTON)  
Official Model Weights: `zhengchong/CatVTON` (Hugging Face)

---

## 🚀 How to Run in Google Colab (3 Minutes Setup)

### Step 1: Open Google Colab

1. Go to [https://colab.research.google.com](https://colab.research.google.com).
2. Click **Upload** and upload `colab/CatVTON_Google_Colab.ipynb` (or create a new notebook).
3. Switch runtime to GPU: **Runtime** > **Change runtime type** > Select **T4 GPU** (free tier supported) or **A100/L4 GPU** (Colab Pro).

### Step 2: Run the Cells

Execute the 3 cells in order:

1. **Cell 1**: Verifies CUDA & GPU availability.
2. **Cell 2**: Clones official CatVTON repository and installs requirements:
   ```bash
   !git clone https://github.com/Zheng-Chong/CatVTON.git /content/CatVTON
   %cd /content/CatVTON
   !pip install -q -r requirements.txt
   !pip install -q gradio==4.44.1 fastapi uvicorn pydantic python-multipart accelerate diffusers transformers torchvision
   ```
3. **Cell 3**: Initializes pipeline with `zhengchong/CatVTON` weights and starts the server with public Gradio sharing.

### Step 3: Copy Your Public URL

When Cell 3 finishes starting, it prints:

```text
Running on public URL: https://xxxxxxxxxxxx.gradio.live
```

Copy this URL. Note: Gradio `.gradio.live` links are temporary and active as long as the Colab cell is running (up to 72 hours per session).

### Step 4: Connect to VÉSTARA

1. In VÉSTARA, navigate to **Virtual Try-On** (`/try-on`).
2. In the **AI Inference Engine** bar, select **CatVTON (Colab GPU)**.
3. Click **Configure Colab GPU** and paste your URL.
4. Click **Test Connection** — a green checkmark will confirm that the GPU is reachable!
5. Select an outfit or wardrobe piece and click **Dress Virtual Me (CatVTON AI)**.

---

## ⚙️ Architecture & Safety

- **No API keys exposed**: Image data is transferred securely between VÉSTARA and your Colab GPU instance.
- **Automatic Fallback**: If your Colab session sleeps or disconnects, VÉSTARA provides a one-click fallback to Gemini AI so try-on never breaks.
- **Configurable**: Endpoint is saved in browser storage (`localStorage`) and can also be set via the `CATVTON_API_URL` environment variable.
