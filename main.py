from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import expenses_router, budgets_router, categories_router

app = FastAPI(
    title="가계부 API",
    description="Supabase 기반 가계부 관리 시스템",
    version="1.0.0"
)

# 307 리다이렉트 방지
app.router.redirect_slashes = False

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(expenses_router, prefix="/api")
app.include_router(budgets_router, prefix="/api")
app.include_router(categories_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "message": "가계부 API 서버가 실행 중입니다.",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
