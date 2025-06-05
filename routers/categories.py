from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from models import CategoryCreate, CategoryResponse
from database import get_supabase_client

router = APIRouter(prefix="/categories", tags=["categories"])

# 임시 사용자 ID
def get_current_user_id():
    return "test-user"

@router.post("", response_model=dict)
async def create_category(
    category: CategoryCreate,
    user_id: str = Depends(get_current_user_id)
):
    """카테고리 생성"""
    supabase = get_supabase_client()
    
    data = {
        "user_id": user_id,
        "name": category.name,
        "color": category.color
    }
    
    try:
        # 중복 카테고리 확인
        existing = supabase.table("categories")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("name", category.name)\
            .execute()
        
        if existing.data:
            raise HTTPException(
                status_code=400, 
                detail="이미 존재하는 카테고리명입니다."
            )
        
        result = supabase.table("categories").insert(data).execute()
        return {"message": "카테고리가 생성되었습니다.", "data": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("", response_model=List[dict])
async def get_categories(
    user_id: str = Depends(get_current_user_id)
):
    """카테고리 목록 조회"""
    supabase = get_supabase_client()
    
    try:
        result = supabase.table("categories")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("name")\
            .execute()
        
        return result.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{category_id}")
async def update_category(
    category_id: str,
    category: CategoryCreate,
    user_id: str = Depends(get_current_user_id)
):
    """카테고리 수정"""
    supabase = get_supabase_client()
    
    update_data = {
        "name": category.name,
        "color": category.color
    }
    
    try:
        # 다른 카테고리와 이름 중복 확인
        existing = supabase.table("categories")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("name", category.name)\
            .neq("id", category_id)\
            .execute()
        
        if existing.data:
            raise HTTPException(
                status_code=400, 
                detail="이미 존재하는 카테고리명입니다."
            )
        
        result = supabase.table("categories")\
            .update(update_data)\
            .eq("id", category_id)\
            .eq("user_id", user_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
        
        return {"message": "카테고리가 수정되었습니다.", "data": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{category_id}")
async def delete_category(
    category_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """카테고리 삭제"""
    supabase = get_supabase_client()
    
    try:
        # 해당 카테고리를 사용하는 지출이나 예산이 있는지 확인
        expenses = supabase.table("expenses")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("category", category_id)\
            .limit(1)\
            .execute()
        
        budgets = supabase.table("budgets")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("category", category_id)\
            .limit(1)\
            .execute()
        
        if expenses.data or budgets.data:
            raise HTTPException(
                status_code=400, 
                detail="이 카테고리를 사용하는 지출이나 예산이 있어 삭제할 수 없습니다."
            )
        
        result = supabase.table("categories")\
            .delete()\
            .eq("id", category_id)\
            .eq("user_id", user_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
        
        return {"message": "카테고리가 삭제되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/usage")
async def get_category_usage(
    user_id: str = Depends(get_current_user_id),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None)
):
    """카테고리별 사용 통계"""
    supabase = get_supabase_client()
    
    try:
        # 카테고리 목록 조회
        categories = supabase.table("categories")\
            .select("*")\
            .eq("user_id", user_id)\
            .execute().data
        
        # 지출 데이터 조회
        expense_query = supabase.table("expenses")\
            .select("category, amount")\
            .eq("user_id", user_id)
        
        if year:
            expense_query = expense_query.gte("date", f"{year}-01-01").lte("date", f"{year}-12-31")
            if month:
                expense_query = expense_query\
                    .gte("date", f"{year}-{month:02d}-01")\
                    .lte("date", f"{year}-{month:02d}-31")
        
        expenses = expense_query.execute().data
        
        # 카테고리별 집계
        usage_stats = {}
        total_amount = 0
        
        for expense in expenses:
            category = expense['category']
            amount = expense['amount']
            total_amount += amount
            
            if category not in usage_stats:
                usage_stats[category] = {
                    "total_amount": 0,
                    "transaction_count": 0
                }
            
            usage_stats[category]["total_amount"] += amount
            usage_stats[category]["transaction_count"] += 1
        
        # 결과 정리
        result = []
        for category in categories:
            cat_name = category['name']
            stats = usage_stats.get(cat_name, {"total_amount": 0, "transaction_count": 0})
            percentage = (stats["total_amount"] / total_amount * 100) if total_amount > 0 else 0
            
            result.append({
                "category_id": category['id'],
                "category_name": cat_name,
                "color": category['color'],
                "total_amount": stats["total_amount"],
                "transaction_count": stats["transaction_count"],
                "percentage": round(percentage, 2)
            })
        
        # 사용량 순으로 정렬
        result.sort(key=lambda x: x['total_amount'], reverse=True)
        
        return {
            "period": f"{year}-{month:02d}" if year and month else str(year) if year else "전체",
            "total_amount": total_amount,
            "categories": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/initialize")
async def initialize_default_categories(
    user_id: str = Depends(get_current_user_id)
):
    """기본 카테고리 초기화"""
    supabase = get_supabase_client()
    
    default_categories = [
        {"name": "식비", "color": "#EF4444"},
        {"name": "교통비", "color": "#3B82F6"},
        {"name": "쇼핑", "color": "#10B981"},
        {"name": "의료비", "color": "#F59E0B"},
        {"name": "문화생활", "color": "#8B5CF6"},
        {"name": "교육", "color": "#06B6D4"},
        {"name": "주거비", "color": "#84CC16"},
        {"name": "기타", "color": "#6B7280"}
    ]
    
    try:
        # 기존 카테고리 확인
        existing = supabase.table("categories")\
            .select("name")\
            .eq("user_id", user_id)\
            .execute()
        
        existing_names = {cat['name'] for cat in existing.data}
        
        # 중복되지 않는 카테고리만 추가
        new_categories = []
        for cat in default_categories:
            if cat['name'] not in existing_names:
                new_categories.append({
                    "user_id": user_id,
                    "name": cat['name'],
                    "color": cat['color']
                })
        
        if new_categories:
            result = supabase.table("categories").insert(new_categories).execute()
            return {
                "message": f"{len(new_categories)}개의 기본 카테고리가 추가되었습니다.",
                "added_categories": [cat['name'] for cat in new_categories]
            }
        else:
            return {"message": "모든 기본 카테고리가 이미 존재합니다."}
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
