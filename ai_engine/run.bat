echo off
echo Starting OIL-SIF AI Brain on http://127.0.0.1:8050
python -m uvicorn main:app --host 127.0.0.1 --port 8050 --reload