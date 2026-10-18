from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from contextlib import asynccontextmanager
import os
import asyncio

from app.core.config import settings
from app.core.init_db import init_db
from app.core.presence import PresenceTracker
from app.modules.sso_module.cookie_signer import verify_cookie

# Import Routers
from app.modules.sso_module.routes import router as sso_router
from app.modules.auth.routes.auth_routes import router as auth_router
from app.modules.course.routes.course_routes import router as course_router
from app.modules.import_export.routes.import_routes import router as import_router
from app.modules.settings.routes import router as settings_router
from app.modules.editor.routes import router as editor_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Asynchronously initialize DB in background
    asyncio.create_task(init_db())
    yield

app = FastAPI(
    title="Reader API",
    description="File-driven LMS Platform with Interactive MDX, Audio Narration & CentralAuth SSO",
    version="1.0.0",
    lifespan=lifespan
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Mount Static Directories
os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
os.makedirs(settings.AUDIO_DIR, exist_ok=True)
static_dir = os.path.join(BASE_DIR, "static")
os.makedirs(static_dir, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=settings.UPLOADS_DIR), name="uploads")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

DIST_DIR = os.path.join(static_dir, "dist")
if os.path.exists(DIST_DIR):
    app.mount("/static/dist", StaticFiles(directory=DIST_DIR), name="dist")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5070",
        "http://localhost:5173",
        "http://localhost:5000",
        "http://127.0.0.1:5070",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5000",
        "https://read.inmind.site",
        "https://reader.inmind.site",
        "https://auth.inmind.site",
        "https://vocab.inmind.site",
        "https://quiz.inmind.site"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.middleware("http")
async def track_presence_middleware(request: Request, call_next):
    raw_cookie = request.cookies.get("user_id")
    if raw_cookie:
        uid = verify_cookie(raw_cookie, settings.SECRET_KEY)
        if uid and uid.isdigit():
            PresenceTracker.touch(int(uid))
    return await call_next(request)

# Include Routers
app.include_router(sso_router)
app.include_router(auth_router)
app.include_router(course_router)
app.include_router(import_router)
app.include_router(settings_router)
app.include_router(editor_router)

# SPA Fallback Handlers
@app.get("/")
@app.get("/login")
@app.get("/courses")
@app.get("/courses/{path:path}")
@app.get("/reader/{path:path}")
@app.get("/editor")
@app.get("/editor/{path:path}")
@app.get("/settings")
@app.get("/admin")
@app.get("/admin/{path:path}")
async def serve_spa_routes(request: Request):
    spa_index = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(spa_index):
        response = FileResponse(spa_index)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        return response
    return JSONResponse(
        status_code=404,
        content={"status": "error", "message": "SPA assets not built yet. Run build_vite.py."}
    )

@app.get("/{full_path:path}")
async def catch_all_spa(request: Request, full_path: str):
    if full_path.startswith("api/") or full_path.startswith("static/") or full_path.startswith("uploads/"):
        raise HTTPException(status_code=404, detail="API or Resource Not Found")

    spa_index = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(spa_index):
        response = FileResponse(spa_index)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        return response
    raise HTTPException(status_code=404, detail="Not Found")
