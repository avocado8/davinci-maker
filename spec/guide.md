# 백엔드

cd backend

(가상환경 없을 시) python -m venv .venv

.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload

venv 활성화가 정책 오류로 막힐 경우
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.venv\Scripts\Activate.ps1

# 프론트엔드

cd frontend
npm run dev
