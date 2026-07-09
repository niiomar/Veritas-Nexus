from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from application.commands.case_commands import CreateCaseCommand
from application.use_cases.case_management import CreateCaseUseCase
from api.dependencies import get_create_case_use_case

router = APIRouter()

class CreateCaseRequest(BaseModel):
    title: str
    description: str | None = None
    priority: str = "MEDIUM"

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_case(
    request: CreateCaseRequest,
    use_case: CreateCaseUseCase = Depends(get_create_case_use_case)
):
    """Opens a new investigation case."""
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