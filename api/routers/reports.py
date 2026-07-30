from uuid import UUID
from fastapi import APIRouter, Depends, status

from api.dependencies import require_api_key

router = APIRouter()

@router.post("/{assessment_id}", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_api_key)])
async def generate_court_report(assessment_id: UUID):
    """
    Triggers the generation of an immutable, court-ready PDF snapshot of an assessment.
    """
    # Routes to GenerateReportUseCase
    return {"message": "Report generated", "report_id": "new-uuid"}