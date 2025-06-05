@echo off
echo 패키지 설치 중...
pip install fastapi uvicorn[standard] supabase python-dotenv pydantic python-multipart

echo 서버 시작 중...
start python main.py

timeout /t 3

echo 프론트엔드 서버 시작 중...
cd frontend
start python -m http.server 3000

timeout /t 2

echo 브라우저 열기...
start http://localhost:3000

pause
