from pydantic import BaseModel, Field
from datetime import date as DateType  # 이름 충돌 방지
from typing import Optional

# 지출 모델
class ExpenseCreate(BaseModel):
    amount: float = Field(..., gt=0, description="지출 금액")
    category: str = Field(..., min_length=1, description="카테고리")
    date: DateType = Field(..., description="지출 날짜")  # DateType 사용
    description: Optional[str] = Field(None, description="설명")

class ExpenseUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    category: Optional[str] = Field(None, min_length=1)
    date: Optional[DateType] = None  # DateType 사용
    description: Optional[str] = None

class ExpenseResponse(BaseModel):
    id: str
    user_id: str
    amount: float
    category: str
    date: DateType  # DateType 사용
    description: Optional[str]
    created_at: str
    updated_at: str

# 예산 모델
class BudgetCreate(BaseModel):
    category: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    period: str = Field(..., pattern="^(monthly|yearly)$")
    year: int = Field(..., ge=2020, le=2030)
    month: Optional[int] = Field(None, ge=1, le=12)

class BudgetResponse(BaseModel):
    id: str
    user_id: str
    category: str
    amount: float
    period: str
    year: int
    month: Optional[int]
    created_at: str
    updated_at: str

# 카테고리 모델
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field("#3B82F6", pattern="^#[0-9A-Fa-f]{6}$")

class CategoryResponse(BaseModel):
    id: str
    user_id: str
    name: str
    color: str
    created_at: str
    updated_at: str
