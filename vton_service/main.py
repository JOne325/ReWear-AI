"""Local adapter for the single-garment IDM-VTON Gradio job."""
import asyncio
import io
import os
import tempfile
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from gradio_client import Client, handle_file
from gradio_client.exceptions import AppError
from PIL import Image, ImageOps, UnidentifiedImageError

app = FastAPI(title="ReWear Try-on")
Image.MAX_IMAGE_PIXELS = 20_000_000
max_upload = 1_500_000
slot = threading.Lock()


def provider_token(provider: str) -> str | bool | None:
    parts = urlsplit(provider)
    if not parts.scheme or (parts.scheme == "https" and (parts.hostname or "").endswith(".hf.space")):
        return os.getenv("HF_TOKEN")
    # Gradio uses locally saved HF credentials by default. Keep them off custom URLs.
    return False


async def read_photo(upload: UploadFile) -> bytes:
    data = await upload.read(max_upload + 1)
    if len(data) > max_upload:
        raise HTTPException(413, "That photo is too large.")
    if not data:
        raise HTTPException(400, "Choose both photos.")
    return data


def prepare_photo(data: bytes, target: Path, garment: bool) -> None:
    try:
        with Image.open(io.BytesIO(data), formats=["JPEG", "PNG"]) as original:
            if original.width * original.height > Image.MAX_IMAGE_PIXELS:
                raise ValueError("Too many pixels")
            image = ImageOps.exif_transpose(original)
            if min(image.size) < 64:
                raise ValueError("Too small")
            if garment:
                image.thumbnail((736, 984))
                image = image.convert("RGBA")
                canvas = Image.new("RGB", (768, 1024), "white")
                canvas.paste(image, ((768 - image.width) // 2, (1024 - image.height) // 2), image)
                image = canvas
            else:
                image.thumbnail((1536, 1536))
                image = image.convert("RGB")
            image.save(target, "JPEG", quality=90)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise HTTPException(400, "Could not read the photo. Try a larger JPEG or PNG.") from error


def render(human: bytes, top: bytes, description: str, stopped: threading.Event) -> bytes:
    provider = os.getenv("VTON_URL")
    if not provider:
        raise HTTPException(503, "Try-on is not configured.")
    if not slot.acquire(blocking=False):
        raise HTTPException(429, "Another try-on is running. Try again in a moment.")
    try:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            person_path, top_path = root / "person.jpg", root / "top.jpg"
            prepare_photo(human, person_path, False)
            prepare_photo(top, top_path, True)
            deadline = time.monotonic() + 150
            if stopped.is_set():
                raise HTTPException(499, "Try-on canceled.")
            client = Client(provider, verbose=False, token=provider_token(provider), analytics_enabled=False,
                            download_files=root, httpx_kwargs={"timeout": 25.0})
            if stopped.is_set():
                raise HTTPException(499, "Try-on canceled.")
            job = client.submit(
                {"background": handle_file(str(person_path)), "layers": [], "composite": None},
                handle_file(str(top_path)), description, True, False, 20, 42,
                api_name="/tryon",
            )
            try:
                while not job.done():
                    if stopped.wait(0.25):
                        raise HTTPException(499, "Try-on canceled.")
                    if time.monotonic() >= deadline:
                        raise HTTPException(504, "Try-on timed out. The GPU may be busy.")
                result = job.result()
                output = result[0] if isinstance(result, (tuple, list)) else result
                with Image.open(output) as image:
                    image.thumbnail((1024, 1536))
                    png = io.BytesIO()
                    image.convert("RGB").save(png, "PNG")
                    return png.getvalue()
            finally:
                if not job.done():
                    try:
                        job.cancel()
                    except Exception:
                        # The remote queue may have already finished or closed the job.
                        pass
    except HTTPException:
        raise
    except AppError as error:
        if "zerogpu quota" in str(error).lower():
            raise HTTPException(429, "shared_gpu_quota") from error
        raise HTTPException(502, "The try-on provider could not make a preview. Try again later.") from error
    except Exception as error:
        raise HTTPException(502, "The try-on provider could not make a preview. Try again later.") from error
    finally:
        slot.release()


@app.get("/health")
def health():
    return {"configured": bool(os.getenv("VTON_URL"))}


@app.post("/tryon")
async def tryon(request: Request, human_img: UploadFile = File(...),
                garm_img: UploadFile = File(...), garment_des: str = Form(...)):
    human = await read_photo(human_img)
    top = await read_photo(garm_img)
    description = " ".join(garment_des.split())[:80]
    if not description:
        raise HTTPException(400, "Provide the top's name.")
    stopped = threading.Event()
    task = asyncio.create_task(asyncio.to_thread(render, human, top, description, stopped))
    try:
        while not task.done():
            if await request.is_disconnected():
                stopped.set()
            await asyncio.wait({task}, timeout=0.25)
        return Response(await task, media_type="image/png", headers={"Cache-Control": "no-store"})
    finally:
        stopped.set()
