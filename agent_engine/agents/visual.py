"""
Visual Agent — Clean 4-Workflow Pipeline
=========================================
Workflow 1: flux-9b-txt2img  → Flux 2 9B + IPAdapter face lock  (txt2img, with identity)
Workflow 2: flux-9b-i2i      → Flux 2 9B img2img + IPAdapter    (face-consistent edits)
Workflow 3: flux-9b-detailer → Z-Image detailer pass             (ColorMatch + Sharpen)
Workflow 4: seedvr2-upscaler → SeedVR2 diffusion upscale to 2048px

LoRA injection: set LORA_NAME env var or pass lora= parameter.
Runs against local ComfyUI via WebSocket + REST API.
"""
import os
import json
import uuid
import asyncio
import aiohttp
import websockets
import requests
import shutil
import io
import sqlite3
import re
import random
from pathlib import Path
from typing import Optional, Dict, Any
from PIL import Image


# ── Constants ──────────────────────────────────────────────────────────────
COMFY_INPUT_DIR = Path("c:/ComfyUI_windows_portable/ComfyUI/input")

# 4 canonical workflow names → template files from Registry
from ..registry import registry
WORKFLOW_MAP = registry.get("workflows", {})

# ── Pipeline Step Definition ────────────────────────────────────────────────
class PipelineStep:
    """Defines one step in the image/video generation pipeline."""
    GENERATE  = "image_base"     # Step 1: base generation
    I2I       = "image_refine"   # Step 2: img2img consistency
    DETAIL    = "image_detail"   # Step 3: Z-Image detailing
    UPSCALE   = "image_upscale"  # Step 4: SeedVR2 upscale
    ANIMATE   = "video_base"     # Video Step: AnimateDiff
    SVD       = "video_refine"   # Video Step: SVD


class VisualAgent:
    def __init__(self):
        self.comfy_url = registry.get("providers", {}).get("comfyui", {}).get("url", "http://127.0.0.1:8188").rstrip("/")
        self.ws_url = self.comfy_url.replace("http://", "ws://").replace("https://", "wss://")
        self.templates_dir = Path(__file__).parent.parent.parent / "src" / "lib" / "comfy-templates"
        self.db_path = Path(__file__).parent.parent.parent / "data" / "factory.db"
        self.client_id = str(uuid.uuid4())
        self.output_dir = Path(__file__).parent.parent.parent / "public" / "outputs" / "images"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    # ══════════════════════════════════════════════════════════════════════
    # PUBLIC PIPELINE METHODS
    # ══════════════════════════════════════════════════════════════════════

    async def run_full_pipeline(
        self,
        influencer_id: str,
        prompt: str,
        negative_prompt: str = "",
        lora: Optional[str] = None,
        steps: list[str] = None,   # Which steps to run, defaults to all 4
    ) -> Optional[str]:
        """
        Run the full 4-step pipeline for an influencer.
        Returns the final output image path.

        steps defaults to: [GENERATE, DETAIL, UPSCALE]
        Use [GENERATE, I2I, DETAIL, UPSCALE] for full consistency pipeline.
        """
        if steps is None:
            steps = [PipelineStep.GENERATE, PipelineStep.DETAIL, PipelineStep.UPSCALE]

        dna, base_image = self._get_influencer_data(influencer_id)
        full_positive = self._build_dna_prompt(dna, prompt)
        full_negative = self._build_dna_negative(dna, negative_prompt)

        current_image: Optional[str] = None

        for step_workflow in steps:
            print(f"[Visual] Pipeline step: {step_workflow}")
            current_image = await self._run_step(
                workflow=step_workflow,
                influencer_id=influencer_id,
                prompt=full_positive,
                negative_prompt=full_negative,
                identity_image=base_image,
                source_image=current_image,  # chain previous output
                lora=lora,
            )
            if not current_image:
                print(f"[Visual] ✗ Pipeline failed at step: {step_workflow}")
                return None
            print(f"[Visual] ✓ Step {step_workflow} → {current_image}")

        return current_image

    async def generate(
        self,
        influencer_id: str,
        prompt: str,
        negative_prompt: str = "",
        workflow: str = "flux-9b-txt2img",
        num_images: int = 1,
        base_image: str = "",
        lora: Optional[str] = None,
    ) -> list[str]:
        """
        Queue N images via a single workflow. Used by burst mode.
        Workflow 1 or 2 depending on whether there's a source image.
        """
        if not await self.check_health():
            print("[Visual] ComfyUI is offline or unreachable.")
            return []

        dna, db_base = self._get_influencer_data(influencer_id)
        identity = base_image or db_base
        full_positive = self._build_dna_prompt(dna, prompt)
        full_negative = self._build_dna_negative(dna, negative_prompt)

        # Auto-select workflow: if there's a source image, use i2i (step 2)
        if workflow == "auto":
            workflow = "flux-9b-i2i" if identity else "flux-9b-txt2img"

        output_paths: list[str] = []
        for _ in range(num_images):
            path = await self._run_step(
                workflow=workflow,
                influencer_id=influencer_id,
                prompt=full_positive,
                negative_prompt=full_negative,
                identity_image=identity,
                lora=lora,
            )
            if path:
                output_paths.append(path)

        return output_paths

    def generate_sync(
        self,
        influencer_id: str,
        prompt: str,
        negative_prompt: str = "",
        workflow: str = "flux-9b-txt2img",
        num_images: int = 1,
        base_image: str = "",
        lora: Optional[str] = None,
        job_id: Optional[str] = None
    ) -> list[str]:
        """Synchronous version for Redis workers."""
        if not self.check_health_sync():
            print(f"[Visual][{job_id}] ComfyUI is offline.")
            return []

        dna, db_base = self._get_influencer_data(influencer_id)
        identity = base_image or db_base
        full_positive = self._build_dna_prompt(dna, prompt)
        full_negative = self._build_dna_negative(dna, negative_prompt)

        output_paths: list[str] = []
        for _ in range(num_images):
            path = self._run_step_sync(
                workflow=workflow,
                prompt=full_positive,
                negative_prompt=full_negative,
                identity_image=identity,
                lora=lora,
            )
            if path:
                output_paths.append(path)

        return output_paths

    async def generate_step(
        self,
        influencer_id: str,
        prompt: str,
        negative_prompt: str = "",
        workflow: str = "flux-9b-i2i",
        source_image: str = "",
        base_image: str = "",
        lora: Optional[str] = None,
    ) -> Optional[str]:
        """Single step — used for manual refine/detail/upscale from the API."""
        dna, db_base = self._get_influencer_data(influencer_id)
        identity = base_image or db_base
        full_positive = self._build_dna_prompt(dna, prompt) if prompt else ""
        full_negative = self._build_dna_negative(dna, negative_prompt)
        return await self._run_step(
            workflow=workflow,
            influencer_id=influencer_id,
            prompt=full_positive,
            negative_prompt=full_negative,
            identity_image=identity,
            source_image=source_image,
            lora=lora,
        )

    def generate_step_sync(
        self,
        influencer_id: str,
        prompt: str,
        negative_prompt: str = "",
        workflow: str = "flux-9b-i2i",
        source_image: str = "",
        base_image: str = "",
        lora: Optional[str] = None,
    ) -> Optional[str]:
        """Single step sync — for Redis workers."""
        dna, db_base = self._get_influencer_data(influencer_id)
        identity = base_image or db_base
        full_positive = self._build_dna_prompt(dna, prompt) if prompt else ""
        full_negative = self._build_dna_negative(dna, negative_prompt)
        return self._run_step_sync(
            workflow=workflow,
            prompt=full_positive,
            negative_prompt=full_negative,
            identity_image=identity,
            source_image=source_image,
            lora=lora,
        )

    async def generate_video_base(
        self,
        influencer_id: str,
        prompt: str,
        source_image: Optional[str] = None,
        workflow: str = "video-animatediff",
        frames: int = 16
    ) -> Optional[str]:
        """
        Specialized method for video generation (AnimateDiff / SVD).
        Injects frame count and source image for motion.
        """
        print(f"[Visual] Generating video base via {workflow}...")
        dna, db_base = self._get_influencer_data(influencer_id)
        identity = source_image or db_base
        full_positive = self._build_dna_prompt(dna, prompt)
        full_negative = self._build_dna_negative(dna, "")

        try:
            wf = self._load_workflow(workflow)
            # Inject prompts and identity
            wf = self._inject_all(wf, full_positive, full_negative, identity, source_image or "")
            
            # Inject frame count (common for AnimateDiff/SVD nodes)
            for node in wf.values():
                if isinstance(node, dict) and "inputs" in node:
                    if "frame_count" in node["inputs"]:
                        node["inputs"]["frame_count"] = frames
                    if "video_frames" in node["inputs"]:
                        node["inputs"]["video_frames"] = frames
            
            prompt_id = await self._queue_prompt_async(wf)
            # Video generation is slow, increased timeout to 15 mins
            return await self._wait_for_image_async(prompt_id, timeout=900) 
        except Exception as e:
            print(f"[Visual] Video generation failed: {e}")
            return None

    # ══════════════════════════════════════════════════════════════════════
    # CORE STEP RUNNER (single workflow execution)
    # ══════════════════════════════════════════════════════════════════════

    async def _run_step(
        self,
        workflow: str,
        influencer_id: str = "",
        prompt: str = "",
        negative_prompt: str = "",
        identity_image: str = "",
        source_image: str = "",
        lora: Optional[str] = None,
    ) -> Optional[str]:
        """Load → inject → queue → wait → save. Async version."""
        try:
            wf = self._load_workflow(workflow)
            wf = self._inject_all(wf, prompt, negative_prompt, identity_image, source_image, lora)
            prompt_id = await self._queue_prompt_async(wf)
            return await self._wait_for_image_async(prompt_id)
        except Exception as e:
            print(f"[Visual] Step '{workflow}' failed: {e}")
            return None

    def _run_step_sync(
        self,
        workflow: str,
        prompt: str = "",
        negative_prompt: str = "",
        identity_image: str = "",
        source_image: str = "",
        lora: Optional[str] = None,
    ) -> Optional[str]:
        """Load → inject → queue → wait → save. Sync version for Redis workers."""
        try:
            wf = self._load_workflow(workflow)
            wf = self._inject_all(wf, prompt, negative_prompt, identity_image, source_image, lora)
            prompt_id = self._queue_prompt_sync(wf)
            return self._wait_for_image_sync(prompt_id)
        except Exception as e:
            print(f"[Visual] Sync step '{workflow}' failed: {e}")
            return None

    # ══════════════════════════════════════════════════════════════════════
    # INJECTION ENGINE
    # ══════════════════════════════════════════════════════════════════════

    def _load_workflow(self, workflow_name: str) -> dict:
        """Load a ComfyUI workflow JSON template."""
        filename = WORKFLOW_MAP.get(workflow_name, f"{workflow_name}.json")
        path = self.templates_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"Workflow template not found: {filename} (for '{workflow_name}')")
        with open(path) as f:
            return json.load(f)

    def _inject_all(
        self,
        workflow: dict,
        positive: str,
        negative: str,
        identity_image: str,
        source_image: str,
        lora: Optional[str] = None,
    ) -> dict:
        """Single-pass injection: prompts, seeds, identity, source, LoRA."""
        wf_str = json.dumps(workflow)

        # Prompts
        wf_str = wf_str.replace("{{POSITIVE_PROMPT}}", positive.replace("\\", "\\\\").replace('"', '\\"'))
        wf_str = wf_str.replace("{{NEGATIVE_PROMPT}}", negative.replace("\\", "\\\\").replace('"', '\\"'))

        # Seed (as literal integer, not string)
        seed = random.randint(0, 0xFFFFFFFFFFFFFF)
        wf_str = re.sub(r'"?\{\{SEED:\d+\}\}"?', str(seed), wf_str)

        # Resolution overrides
        wf_str = re.sub(r'"?\{\{WIDTH:\d+\}\}"?', "1024", wf_str)
        wf_str = re.sub(r'"?\{\{HEIGHT:\d+\}\}"?', "1024", wf_str)

        # SeedVR2 target resolution
        wf_str = re.sub(r'"?\{\{TARGET_RESOLUTION:\d+\}\}"?', "2048", wf_str)

        wf = json.loads(wf_str)

        # Identity image injection ({{BASE_IMAGE}})
        if identity_image:
            filename = self._copy_to_comfy_input(identity_image, prefix="id_")
            if filename:
                wf_str2 = json.dumps(wf).replace("{{BASE_IMAGE}}", filename)
                wf = json.loads(wf_str2)

        # Source/chain image injection ({{SOURCE_IMAGE}} and {{IMAGE_FILENAME}})
        if source_image:
            filename = self._copy_to_comfy_input(source_image, prefix="src_")
            if filename:
                wf_str2 = json.dumps(wf)
                wf_str2 = wf_str2.replace("{{SOURCE_IMAGE}}", filename)
                wf_str2 = wf_str2.replace("{{IMAGE_FILENAME}}", filename)
                wf = json.loads(wf_str2)

        # LoRA injection — insert a LoRALoader node before the UNet
        if lora:
            wf = self._inject_lora(wf, lora)

        return wf

    def _copy_to_comfy_input(self, image_path: str, prefix: str = "") -> Optional[str]:
        """
        Resolve an image path (relative URL or absolute), copy it to ComfyUI input dir,
        and return just the filename that ComfyUI can use in LoadImage.
        """
        path = Path(image_path)

        # Resolve relative paths like /outputs/images/foo.jpg
        if str(image_path).startswith("/outputs/"):
            path = Path(__file__).parent.parent.parent / "public" / image_path.lstrip("/")
        elif str(image_path).startswith("/"):
            path = Path(__file__).parent.parent.parent / "public" / image_path.lstrip("/")

        if not path.exists():
            print(f"[Visual] Image not found: {path}")
            return None

        unique = uuid.uuid4().hex[:8]
        dest_name = f"{prefix}{unique}_{path.name}"
        dest = COMFY_INPUT_DIR / dest_name
        COMFY_INPUT_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy(path, dest)
        print(f"[Visual] Copied to ComfyUI input: {dest_name}")
        return dest_name

    def _inject_lora(self, workflow: dict, lora_name: str) -> dict:
        """
        Insert a LoRALoaderModelOnly node between the UNet loader and the rest.
        Finds the first UnetLoaderGGUF / CheckpointLoaderSimple and patches
        the first downstream consumer to load through LoRA.
        """
        # Find the UNet loader node
        unet_node_id = None
        for node_id, node in workflow.items():
            if node.get("class_type") in ("UnetLoaderGGUF", "CheckpointLoaderSimple"):
                unet_node_id = node_id
                break

        if not unet_node_id:
            print("[Visual] LoRA: No UNet node found. Skipping LoRA injection.")
            return workflow

        # Generate a new node ID
        new_id = str(max(int(k) for k in workflow.keys() if k.isdigit()) + 1)

        # Insert LoRALoaderModelOnly node
        workflow[new_id] = {
            "inputs": {
                "lora_name": lora_name,
                "strength_model": 0.8,
                "model": [unet_node_id, 0],
            },
            "class_type": "LoraLoaderModelOnly"
        }

        # Reroute all references from [unet_node_id, 0] to [new_id, 0]
        wf_str = json.dumps(workflow)
        # Replace [unet_node_id, 0] references (but not in the new node itself)
        old_ref = json.dumps([unet_node_id, 0])
        new_ref = json.dumps([new_id, 0])
        # Only replace in non-LoRA nodes
        result = {}
        for nid, node in json.loads(wf_str).items():
            if nid == new_id:
                result[nid] = node
                continue
            node_str = json.dumps(node)
            node_str = node_str.replace(old_ref, new_ref)
            result[nid] = json.loads(node_str)

        print(f"[Visual] LoRA injected: {lora_name} (strength 0.8)")
        return result

    # ══════════════════════════════════════════════════════════════════════
    # DNA PROMPT BUILDERS
    # ══════════════════════════════════════════════════════════════════════

    def _get_influencer_data(self, influencer_id: str) -> tuple[Dict[str, Any], str]:
        """Fetch DNA JSON and avatar/base image path from SQLite."""
        if not influencer_id:
            return {}, ""
        try:
            conn = sqlite3.connect(str(self.db_path))
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT dna_json, base_image_path FROM influencers WHERE id = ?",
                (influencer_id,)
            ).fetchone()
            conn.close()
            if row:
                dna_str = row["dna_json"] or ""
                base = row["base_image_path"] or ""
                dna = json.loads(dna_str) if dna_str.strip().startswith("{") else {}
                return dna, base
        except Exception as e:
            print(f"[Visual] DNA fetch error: {e}")
        return {}, ""

    def _build_dna_prompt(self, dna: dict, user_prompt: str) -> str:
        """Build a Hasselblad-grade photorealistic prompt from DNA."""
        if not dna:
            return user_prompt

        f = dna.get("face", {})
        h = dna.get("hair", {})
        s = dna.get("style", {})
        id_data = dna.get("identity", {})

        quality = registry.get("strategies", {}).get("prompt_quality_suffix", "high quality photo")
        subject = (
            f"stunning {id_data.get('ethnicity', '')} woman, "
            f"{id_data.get('age', 24)} years old, "
            "authentic human proportions, sharp cinematic focus"
        )
        face = (
            f"{f.get('skin_tone', '')} skin with {f.get('skin_texture', 'natural')} texture, "
            f"{f.get('shape', 'oval')} face, {f.get('eye_color', 'brown')} {f.get('eye_shape', 'almond')} eyes, "
            f"{f.get('lip_fullness', 'medium')} lips"
        )
        hair = f"{h.get('color', 'dark')} {h.get('texture', 'straight')} hair, {h.get('length', 'long')} length"
        style = f"{s.get('makeup_style', 'natural')} makeup, {s.get('primary_aesthetic', '')} aesthetic"

        full = f"{quality}, {subject}, {face}, {hair}, {style}, SCENARIO: {user_prompt}"
        return " ".join(full.split())  # strip newlines

    def _build_dna_negative(self, dna: dict, user_negative: str) -> str:
        """Build a comprehensive negative prompt."""
        base = (
            "cartoon, 3d render, anime, cgi, illustration, painting, drawing, "
            "plastic skin, fake, artificial, poorly drawn face, mutated, "
            "blurry, low quality, watermark, text, logo"
        )
        return f"{base}, {user_negative}".strip(", ") if user_negative else base

    # ══════════════════════════════════════════════════════════════════════
    # COMFYUI API — ASYNC
    # ══════════════════════════════════════════════════════════════════════

    async def check_health(self) -> bool:
        try:
            async with aiohttp.ClientSession() as s:
                async with s.get(f"{self.comfy_url}/system_stats", timeout=aiohttp.ClientTimeout(total=3)) as r:
                    return r.status == 200
        except Exception:
            return False

    async def _queue_prompt_async(self, workflow: dict) -> str:
        clean = {str(k): v for k, v in workflow.items() if isinstance(v, dict) and "class_type" in v}
        payload = {"prompt": clean, "client_id": self.client_id}
        async with aiohttp.ClientSession() as s:
            async with s.post(
                f"{self.comfy_url}/prompt",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                if r.status != 200:
                    raise RuntimeError(f"ComfyUI queue error ({r.status}): {await r.text()}")
                data = await r.json()
                return data["prompt_id"]

    async def _wait_for_image_async(self, prompt_id: str, timeout: int = 600) -> Optional[str]:
        """Listen on WebSocket until execution completes, then fetch image."""
        ws_endpoint = f"{self.ws_url}/ws?clientId={self.client_id}"
        try:
            async with websockets.connect(ws_endpoint) as ws:
                deadline = asyncio.get_event_loop().time() + timeout
                async for raw_msg in ws:
                    if asyncio.get_event_loop().time() > deadline:
                        raise TimeoutError(f"ComfyUI timed out after {timeout}s")
                    try:
                        msg = json.loads(raw_msg)
                    except Exception:
                        continue
                    if (
                        msg.get("type") == "executing"
                        and msg.get("data", {}).get("prompt_id") == prompt_id
                        and msg["data"].get("node") is None
                    ):
                        return await self._fetch_and_save_async(prompt_id)
        except Exception as e:
            print(f"[Visual] WebSocket error: {e}")
        return None

    async def _fetch_and_save_async(self, prompt_id: str) -> Optional[str]:
        async with aiohttp.ClientSession() as s:
            try:
                async with s.get(
                    f"{self.comfy_url}/history/{prompt_id}",
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as r:
                    if r.status != 200:
                        return None
                    history = await r.json()
                    outputs = history.get(prompt_id, {}).get("outputs", {})
                    for node_output in outputs.values():
                        for img in node_output.get("images", []):
                            url = (
                                f"{self.comfy_url}/view"
                                f"?filename={img['filename']}"
                                f"&subfolder={img.get('subfolder', '')}"
                                f"&type={img.get('type', 'output')}"
                            )
                            return await self._download_and_optimize_async(s, url, img["filename"])
            except Exception as e:
                print(f"[Visual] Fetch error: {e}")
        return None

    async def _download_and_optimize_async(
        self, session: aiohttp.ClientSession, url: str, filename: str
    ) -> str:
        local_name = f"opt_{uuid.uuid4().hex[:8]}_{filename}"
        local_path = self.output_dir / local_name
        async with session.get(url) as r:
            if r.status == 200:
                data = await r.read()
                img = Image.open(io.BytesIO(data))
                if img.width > 2048:
                    ratio = 2048 / img.width
                    img = img.resize((2048, int(img.height * ratio)), Image.LANCZOS)
                img.save(local_path, "JPEG", quality=92, optimize=True)
                return f"/outputs/images/{local_name}"
        return url

    # ══════════════════════════════════════════════════════════════════════
    # COMFYUI API — SYNC (Redis workers)
    # ══════════════════════════════════════════════════════════════════════

    def check_health_sync(self) -> bool:
        try:
            r = requests.get(f"{self.comfy_url}/system_stats", timeout=5)
            return r.status_code == 200
        except Exception:
            return False

    def _queue_prompt_sync(self, workflow: dict) -> str:
        clean = {str(k): v for k, v in workflow.items() if isinstance(v, dict) and "class_type" in v}
        payload = {"prompt": clean, "client_id": self.client_id}
        r = requests.post(f"{self.comfy_url}/prompt", json=payload, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"ComfyUI error: {r.text}")
        return r.json()["prompt_id"]

    def _wait_for_image_sync(self, prompt_id: str, timeout: int = 600) -> Optional[str]:
        import time
        start = time.time()
        while time.time() - start < timeout:
            r = requests.get(f"{self.comfy_url}/history/{prompt_id}", timeout=10)
            if r.status_code == 200 and prompt_id in r.json():
                return self._fetch_and_save_sync(prompt_id)
            time.sleep(2)
        return None

    def _fetch_and_save_sync(self, prompt_id: str) -> Optional[str]:
        try:
            r = requests.get(f"{self.comfy_url}/history/{prompt_id}", timeout=10)
            if r.status_code != 200:
                return None
            outputs = r.json().get(prompt_id, {}).get("outputs", {})
            for node_output in outputs.values():
                for img in node_output.get("images", []):
                    url = (
                        f"{self.comfy_url}/view"
                        f"?filename={img['filename']}"
                        f"&subfolder={img.get('subfolder', '')}"
                        f"&type={img.get('type', 'output')}"
                    )
                    return self._download_and_optimize_sync(url, img["filename"])
        except Exception as e:
            print(f"[Visual] Sync fetch error: {e}")
        return None

    def _download_and_optimize_sync(self, url: str, filename: str) -> str:
        local_name = f"opt_{uuid.uuid4().hex[:8]}_{filename}"
        local_path = self.output_dir / local_name
        try:
            r = requests.get(url, timeout=60)
            if r.status_code == 200:
                img = Image.open(io.BytesIO(r.content))
                if img.width > 2048:
                    ratio = 2048 / img.width
                    img = img.resize((2048, int(img.height * ratio)), Image.LANCZOS)
                img.save(local_path, "JPEG", quality=92, optimize=True)
                return f"/outputs/images/{local_name}"
        except Exception as e:
            print(f"[Visual] Sync optimize error: {e}")
        return url
