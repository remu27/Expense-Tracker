from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
import calendar
from models import BudgetCreate, BudgetResponse
from database import get_supabase_client

router = APIRouter(prefix="/budgets", tags=["budgets"])

# 임시 사용자 ID (실제로는 JWT 토큰에서 추출)
def get_current_user_id():
    return "test-user"

@router.post("", response_model=dict)
async def create_budget(
    budget: BudgetCreate,
    user_id: str = Depends(get_current_user_id)
):
    """예산 설정"""
    supabase = get_supabase_client()
    
    data = {
        "user_id": user_id,
        "category": budget.category,
        "amount": budget.amount,
        "period": budget.period,
        "year": budget.year,
        "month": budget.month if budget.period == "monthly" else None
    }
    
    try:
        # 기존 예산이 있는지 확인
        existing = supabase.table("budgets")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("category", budget.category)\
            .eq("period", budget.period)\
            .eq("year", budget.year)
        
        if budget.period == "monthly" and budget.month:
            existing = existing.eq("month", budget.month)
        
        existing_result = existing.execute()
        
        if existing_result.data:
            raise HTTPException(
                status_code=400, 
                detail="해당 기간에 이미 예산이 설정되어 있습니다."
            )
        
        result = supabase.table("budgets").insert(data).execute()
        return {"message": "예산이 설정되었습니다.", "data": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("", response_model=List[dict])
async def get_budgets(
    user_id: str = Depends(get_current_user_id),
    period: Optional[str] = Query(None, pattern="^(monthly|yearly)$"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    category: Optional[str] = Query(None)
):
    """예산 목록 조회"""
    supabase = get_supabase_client()
    
    query = supabase.table("budgets").select("*").eq("user_id", user_id)
    
    if period:
        query = query.eq("period", period)
    if year:
        query = query.eq("year", year)
    if month:
        query = query.eq("month", month)
    if category:
        query = query.eq("category", category)
    
    query = query.order("created_at", desc=True)
    
    try:
        result = query.execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{budget_id}")
async def update_budget(
    budget_id: str,
    budget: BudgetCreate,
    user_id: str = Depends(get_current_user_id)
):
    """예산 수정"""
    supabase = get_supabase_client()
    
    update_data = {
        "category": budget.category,
        "amount": budget.amount,
        "period": budget.period,
        "year": budget.year,
        "month": budget.month if budget.period == "monthly" else None
    }
    
    try:
        result = supabase.table("budgets")\
            .update(update_data)\
            .eq("id", budget_id)\
            .eq("user_id", user_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="예산을 찾을 수 없습니다.")
        
        return {"message": "예산이 수정되었습니다.", "data": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{budget_id}")
async def delete_budget(
    budget_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """예산 삭제"""
    supabase = get_supabase_client()
    
    try:
        result = supabase.table("budgets")\
            .delete()\
            .eq("id", budget_id)\
            .eq("user_id", user_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="예산을 찾을 수 없습니다.")
        
        return {"message": "예산이 삭제되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status")
async def get_budget_status(
    user_id: str = Depends(get_current_user_id),
    year: int = Query(..., description="조회할 연도"),
    month: Optional[int] = Query(None, description="조회할 월 (월별 예산용)")
):
    """예산 대비 지출 현황 조회"""
    supabase = get_supabase_client()
    
    try:
        # 예산 조회
        budget_query = supabase.table("budgets")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("year", year)
        
        if month:
            budget_query = budget_query.eq("period", "monthly").eq("month", month)
        else:
            budget_query = budget_query.eq("period", "yearly")
        
        budgets = budget_query.execute().data
        
        # 해당 기간 지출 조회
        if month:
            # 월별 조회 - calendar.monthrange로 정확한 마지막 날 계산
            last_day = calendar.monthrange(year, month)[1]
            start_date = f"{year}-{month:02d}-01"
            end_date = f"{year}-{month:02d}-{last_day:02d}"
        else:
            # 연별 조회
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
        
        expense_query = supabase.table("expenses")\
            .select("category, amount")\
            .eq("user_id", user_id)\
            .gte("date", start_date)\
            .lte("date", end_date)
        
        expenses = expense_query.execute().data
        
        # 카테고리별 지출 집계
        expense_by_category = {}
        for expense in expenses:
            category = expense['category']
            if category not in expense_by_category:
                expense_by_category[category] = 0
            expense_by_category[category] += float(expense['amount'])
        
        # 예산 대비 지출 현황 계산
        budget_status = []
        for budget in budgets:
            category = budget['category']
            budget_amount = float(budget['amount'])
            spent_amount = expense_by_category.get(category, 0)
            remaining = budget_amount - spent_amount
            usage_percentage = (spent_amount / budget_amount * 100) if budget_amount > 0 else 0
            
            budget_status.append({
                "category": category,
                "budget_amount": budget_amount,
                "spent_amount": spent_amount,
                "remaining_amount": remaining,
                "usage_percentage": round(usage_percentage, 2),
                "is_over_budget": spent_amount > budget_amount,
                "period": budget['period'],
                "year": budget['year'],
                "month": budget.get('month')
            })
        
        return {
            "period": f"{year}-{month:02d}" if month else str(year),
            "budget_status": budget_status,
            "total_budget": sum(b['budget_amount'] for b in budget_status),
            "total_spent": sum(b['spent_amount'] for b in budget_status)
        }
        
    except Exception as e:
        print(f"Budget status error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/alerts")
async def get_budget_alerts(
    user_id: str = Depends(get_current_user_id),
    threshold: float = Query(80.0, description="알림 임계값 (퍼센트)")
):
    """예산 초과 위험 알림"""
    supabase = get_supabase_client()
    
    try:
        from datetime import datetime
        current_date = datetime.now()
        current_year = current_date.year
        current_month = current_date.month
        
        # 현재 월의 예산 상태 조회
        status_response = await get_budget_status(user_id, current_year, current_month)
        
        alerts = []
        for budget in status_response['budget_status']:
            if budget['usage_percentage'] >= threshold:
                alert_type = "over_budget" if budget['is_over_budget'] else "warning"
                alerts.append({
                    "type": alert_type,
                    "category": budget['category'],
                    "usage_percentage": budget['usage_percentage'],
                    "message": f"{budget['category']} 카테고리가 예산의 {budget['usage_percentage']:.1f}%를 사용했습니다."
                })
        
        return {
            "alerts": alerts,
            "alert_count": len(alerts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
