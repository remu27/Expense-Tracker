from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import date, datetime
from models import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from database import get_supabase_client

router = APIRouter(prefix="/expenses", tags=["expenses"])

# 임시 사용자 ID (실제로는 JWT 토큰에서 추출)
def get_current_user_id():
    return "test-user"  # 실제 UUID 형식

@router.post("", response_model=dict)
async def create_expense(
    expense: ExpenseCreate,
    user_id: str = Depends(get_current_user_id)
):
    """지출 추가"""
    supabase = get_supabase_client()
    
    data = {
        "user_id": user_id,
        "amount": expense.amount,
        "category": expense.category,
        "date": expense.date.isoformat(),
        "description": expense.description
    }
    
    try:
        result = supabase.table("expenses").insert(data).execute()
        return {"message": "지출이 추가되었습니다.", "data": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("", response_model=List[dict])
async def get_expenses(
    user_id: str = Depends(get_current_user_id),
    category: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(100, le=1000)
):
    """지출 목록 조회 (필터링 가능)"""
    supabase = get_supabase_client()
    
    query = supabase.table("expenses").select("*").eq("user_id", user_id)
    
    if category:
        query = query.eq("category", category)
    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())
    
    query = query.order("date", desc=True).limit(limit)
    
    try:
        result = query.execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{expense_id}")
async def update_expense(
    expense_id: str,
    expense: ExpenseUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """지출 수정"""
    supabase = get_supabase_client()
    
    # 업데이트할 데이터만 추출
    update_data = {k: v for k, v in expense.dict().items() if v is not None}
    if "date" in update_data:
        update_data["date"] = update_data["date"].isoformat()
    
    try:
        result = supabase.table("expenses")\
            .update(update_data)\
            .eq("id", expense_id)\
            .eq("user_id", user_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="지출 내역을 찾을 수 없습니다.")
        
        return {"message": "지출이 수정되었습니다.", "data": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """지출 삭제"""
    supabase = get_supabase_client()
    
    try:
        result = supabase.table("expenses")\
            .delete()\
            .eq("id", expense_id)\
            .eq("user_id", user_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="지출 내역을 찾을 수 없습니다.")
        
        return {"message": "지출이 삭제되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/summary/category")
async def get_category_summary(
    user_id: str = Depends(get_current_user_id),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None)
):
    """카테고리별 지출 요약"""
    supabase = get_supabase_client()
    
    # PostgreSQL 함수 호출 또는 직접 쿼리
    query = """
    SELECT 
        category,
        SUM(amount) as total_amount,
        COUNT(*) as count,
        AVG(amount) as avg_amount
    FROM expenses 
    WHERE user_id = %s
    """
    params = [user_id]
    
    if year:
        query += " AND EXTRACT(YEAR FROM date) = %s"
        params.append(year)
    if month:
        query += " AND EXTRACT(MONTH FROM date) = %s"
        params.append(month)
    
    query += " GROUP BY category ORDER BY total_amount DESC"
    
    try:
        result = supabase.rpc('execute_sql', {
            'query': query,
            'params': params
        }).execute()
        return result.data
    except Exception as e:
        # 간단한 대안: Python에서 집계
        expenses = supabase.table("expenses").select("*").eq("user_id", user_id).execute()
        
        summary = {}
        for expense in expenses.data:
            cat = expense['category']
            if cat not in summary:
                summary[cat] = {'total_amount': 0, 'count': 0}
            summary[cat]['total_amount'] += expense['amount']
            summary[cat]['count'] += 1
        
        return [{'category': k, **v} for k, v in summary.items()]

@router.get("/summary/monthly")
async def get_monthly_summary(
    user_id: str = Depends(get_current_user_id),
    year: Optional[int] = Query(None)
):
    """월별 지출 요약"""
    supabase = get_supabase_client()
    
    query = supabase.table("expenses").select("*").eq("user_id", user_id)
    
    if year:
        query = query.gte("date", f"{year}-01-01").lte("date", f"{year}-12-31")
    
    try:
        result = query.execute()
        
        # Python에서 월별 집계
        monthly_summary = {}
        for expense in result.data:
            expense_date = datetime.fromisoformat(expense['date'])
            month_key = f"{expense_date.year}-{expense_date.month:02d}"
            
            if month_key not in monthly_summary:
                monthly_summary[month_key] = 0
            monthly_summary[month_key] += expense['amount']
        
        return [{'month': k, 'total_amount': v} for k, v in sorted(monthly_summary.items())]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
