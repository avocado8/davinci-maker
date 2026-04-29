from dotenv import load_dotenv

load_dotenv()

import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .dependencies.auth import verify_token
from .routes import ai_svg_pipeline, auth, image_pipeline

app = FastAPI(title="Davinci Maker API")

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(image_pipeline.router, dependencies=[Depends(verify_token)])
app.include_router(ai_svg_pipeline.router, dependencies=[Depends(verify_token)])
