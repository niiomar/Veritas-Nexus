from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Your existing CQRS imports
from application.commands.case_commands import CreateCaseCommand
from application.use_cases.case_management import CreateCaseUseCase

# We added get_db_session here to handle the direct database updates!
from api.dependencies import get_create_case_use_case, get_db_session

router = APIRouter()

# Updated to perfectly match the payload sent from frontend/src/services/api.ts
class CaseRequest(BaseModel):
    title: str
    alias: str | None = None
    priority: str = "MEDIUM"
    analyst: str | None = None
    description: str | None = None

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_case(
    request: CaseRequest,
    use_case: CreateCaseUseCase = Depends(get_create_case_use_case)
):
    """Opens a new investigation case."""
    
    # Note: If you want 'alias' and 'analyst' saved during creation, 
    # you will eventually need to update your CreateCaseCommand class to accept them!
    command = CreateCaseCommand(
        title=request.title,
        description=request.description,
        priority=request.priority
    )
    
    case_id = await use_case.execute(command)
    return {"status": "success", "case_id": case_id}

@router.get("/{case_id}")
async def get_case(case_id: UUID):
    # This would route to a GetCaseQuery handler in CQRS
    return {"message": f"Details for case {case_id}"}
    
# Missing Endpoints
@router.put("/{case_id}")
async def update_case(
    case_id: UUID,
    request: CaseRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Updates an existing case. Fixes the 405 Method Not Allowed error."""
    try:
        stmt = text("""
            UPDATE core.cases 
            SET title = :title, alias = :alias, priority = :priority, analyst = :analyst, description = :description
            WHERE id = :id
            RETURNING id, title, alias, priority, analyst, description
        """)
        
        result = await db.execute(stmt, {
            "id": str(case_id),
            "title": request.title,
            "alias": request.alias,
            "priority": request.priority,
            "analyst": request.analyst,
            "description": request.description
        })
        await db.commit()
        
        row = result.mappings().fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Case not found")
            
        return dict(row)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update case in PostgreSQL: {str(e)}")

@router.delete("/{case_id}")
async def delete_case(
    case_id: UUID,
    db: AsyncSession = Depends(get_db_session)
):
    """Deletes a case from the system."""
    try:
        stmt = text("DELETE FROM core.cases WHERE id = :id RETURNING id")
        result = await db.execute(stmt, {"id": str(case_id)})
        await db.commit()
        
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Case not found")
            
        return {"status": "success", "message": "Case deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete case from PostgreSQL: {str(e)}")
