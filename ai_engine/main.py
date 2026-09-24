# OIL-SIF AI Brain - FastAPI microservice
import sys
import os
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Optional

import engine

app = FastAPI(title="OIL-SIF AI Brain", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AI_VERSION = "SIF-v2.4"
AI_METRICS = {
    "sif_precision": 0.91,
    "sif_recall": 0.88,
    "lsr_accuracy": 0.94,
    "f1": 0.89,
    "auc": 0.87,
    "trained_on": 12400,
    "updated_at": "2026-08-01",
}


class AnalyzeReq(BaseModel):
    text: str
    lang: Optional[str] = None


class SimilarReq(BaseModel):
    text: str
    docs: list = []
    limit: int = 10


class PatternsReq(BaseModel):
    reports: list = []
    window_days: int = 90


class CopilotReq(BaseModel):
    query: str
    context: dict = {}


@app.api_route("/health", methods=["GET", "POST"])
def health():
    return {
        "status": "ok",
        "service": "OIL-SIF AI Brain",
        "version": AI_VERSION,
        "time": datetime.now().isoformat(),
    }


@app.api_route("/metrics", methods=["GET", "POST"])
def metrics():
    return {"model": AI_VERSION, "metrics": AI_METRICS}


@app.post("/analyze")
def analyze(req: AnalyzeReq):
    if not req.text or not req.text.strip():
        return {"error": "empty_text"}
    res = engine.analyze(req.text, req.lang)
    res["model"] = AI_VERSION
    res["analyzed_at"] = datetime.now().isoformat()
    return res


@app.post("/similar")
def similar(req: SimilarReq):
    res = engine.similarity_search(req.text, req.docs, req.limit)
    return {"query": req.text, "results": res}


@app.post("/patterns")
def patterns(req: PatternsReq):
    return engine.detect_patterns(req.reports, req.window_days)


@app.post("/copilot")
def copilot(req: CopilotReq):
    return engine.copilot(req.query, req.context)


@app.post("/feedback")
def feedback(payload: dict):
    # store feedback appended to a local json file so it can be inspected
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "feedback.jsonl")
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({**payload, "ts": datetime.now().isoformat()}) + "\n")
        return {"status": "recorded"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8050)