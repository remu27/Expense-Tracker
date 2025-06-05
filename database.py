import os
from supabase import create_client, Client
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 환경변수 확인
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

print(f"🔍 SUPABASE_URL: {supabase_url}")
print(f"🔍 SUPABASE_KEY: {'설정됨' if supabase_key else '설정되지 않음'}")

if not supabase_url:
    raise ValueError("❌ SUPABASE_URL이 설정되지 않았습니다.")
if not supabase_key:
    raise ValueError("❌ SUPABASE_KEY가 설정되지 않았습니다.")

try:
    supabase: Client = create_client(supabase_url, supabase_key)
    print("✅ Supabase 클라이언트 생성 성공")
except Exception as e:
    print(f"❌ Supabase 클라이언트 생성 실패: {e}")
    raise

def get_supabase_client():
    return supabase
