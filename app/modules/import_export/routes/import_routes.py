from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from pydantic import BaseModel

from app.core.db import get_db
from app.modules.auth.routes.auth_routes import get_current_admin
from app.modules.auth.models import User
from app.modules.import_export.services.batch_importer import BatchImporter

router = APIRouter(prefix="/api/v1/import", tags=["Batch Import"])

class FolderImportRequest(BaseModel):
    folder_path: str
    course_title: Optional[str] = None

@router.post("/zip")
async def import_zip_file(
    file: UploadFile = File(...),
    course_title: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip archives are supported")

    content = await file.read()
    try:
        result = await BatchImporter.import_from_zip(content, db, course_title)
        return {
            "status": "success",
            "message": "Course batch imported successfully from zip",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process zip: {str(e)}")

@router.post("/folder")
async def import_folder_path(
    data: FolderImportRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    try:
        result = await BatchImporter.import_from_folder(data.folder_path, db, data.course_title)
        return {
            "status": "success",
            "message": "Course batch imported successfully from folder",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to import from folder: {str(e)}")
