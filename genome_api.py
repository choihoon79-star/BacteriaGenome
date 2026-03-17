"""
genome_api.py — Bakta Cloud API 연동 FastAPI 백엔드
-------------------------------------------------
실행:
    pip install fastapi uvicorn httpx python-multipart
    uvicorn genome_api:app --reload --port 8000

엔드포인트:
    POST /upload       : FASTA 업로드 → Bakta 제출 → job_id 반환
    GET  /status/{id}  : Bakta 작업 상태 확인
    GET  /result/{id}  : 완료된 결과를 내부 포맷 JSON으로 반환
"""

import asyncio
import io
import json
import re
from typing import Optional

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# ── Bakta API 기본 URL ──────────────────────────────────────────
BAKTA_BASE = "https://api.bakta.computational.bio/api/v1"

# ── 앱 초기화 ────────────────────────────────────────────────────
app = FastAPI(title="Genome Annotation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Bakta feature type → 내부 gene type 매핑 ─────────────────────
TYPE_MAP = {
    "tRNA"   : "rrna",
    "rRNA"   : "rrna",
    "tmRNA"  : "rrna",
    "ncRNA"  : "rrna",
    "CDS"    : "essential",
    "IS"     : "mobile_element",
    "oriC"   : "essential",
    "oriV"   : "essential",
    "oriT"   : "mobile_element",
    "gap"    : "essential",
    "sorf"   : "essential",
}

COLOR_MAP = {
    "tRNA"  : "#06b6d4",
    "rRNA"  : "#8b5cf6",
    "tmRNA" : "#06b6d4",
    "IS"    : "#ffe066",
    "oriC"  : "#00ffc8",
    "CDS"   : "#1a3a8f",
}


# ════════════════════════════════════════════════════════════════
# 유틸 함수
# ════════════════════════════════════════════════════════════════

def parse_bakta_features(features: list, genome_len: int) -> list:
    """Bakta JSON feature 배열 → 내부 detectedGenes 포맷 변환."""
    genes = []
    for f in features:
        ftype = f.get("type", "CDS")
        start = f.get("start", 0)
        stop  = f.get("stop",  start + 100)
        strand = "+" if f.get("strand", 1) >= 0 else "-"
        locus  = f.get("locus", f.get("gene", ftype))
        product = f.get("product", f.get("db_xrefs", {}).get("ncbi_protein", ""))
        if isinstance(product, list):
            product = product[0] if product else ""

        gene_type = TYPE_MAP.get(ftype, "essential")

        # 항생제 내성 관련 키워드
        if any(kw in product.lower() for kw in
               ["resist", "beta-lacta", "aminogly", "tetracy", "chloram", "vanc"]):
            gene_type = "antibiotic_resistance"
        elif any(kw in product.lower() for kw in
                 ["virulence", "toxin", "invasion", "adhesin", "hemolysin"]):
            gene_type = "virulence"
        elif any(kw in product.lower() for kw in
                 ["transpos", "integrase", "recombinase", "IS"]):
            gene_type = "mobile_element"
        elif any(kw in product.lower() for kw in
                 ["metabol", "biosyn", "dehydrogenase", "synthase", "reductase"]):
            gene_type = "metabolism"

        genes.append({
            "name"          : locus or ftype,
            "fullName"      : product or locus or ftype,
            "type"          : gene_type,
            "startPos"      : start,
            "endPos"        : stop,
            "geneLength"    : abs(stop - start),
            "strand"        : strand,
            "color"         : COLOR_MAP.get(ftype, "#1a3a8f"),
            "expressionBase": 0.7,
            "expressionLevel": 0.7,
            "expressionLabel": "MED",
            "chromosome"    : f.get("contig", "I"),
            "description"   : product,
            "functions"     : [product] if product else [],
            "rna"           : "",
            "organism"      : "",
        })

    genes.sort(key=lambda g: g["startPos"])
    return genes


def parse_gff3(text: str, genome_len: int) -> list:
    """GFF3 텍스트 → 내부 detectedGenes 포맷 변환 (fallback)."""
    genes = []
    for line in text.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        cols = line.split("\t")
        if len(cols) < 9:
            continue
        ftype  = cols[2]
        start  = int(cols[3]) - 1   # GFF3 is 1-based
        end    = int(cols[4])
        strand = cols[6]
        attrs  = dict(re.findall(r'(\w+)=([^;]+)', cols[8]))
        name   = attrs.get("Name", attrs.get("ID", ftype))
        product = attrs.get("product", "")

        gene_type = TYPE_MAP.get(ftype, "essential")
        if any(kw in product.lower() for kw in ["resist", "beta-lacta"]):
            gene_type = "antibiotic_resistance"

        genes.append({
            "name"          : name,
            "fullName"      : product or name,
            "type"          : gene_type,
            "startPos"      : start,
            "endPos"        : end,
            "geneLength"    : end - start,
            "strand"        : strand,
            "color"         : "#1a3a8f",
            "expressionBase": 0.7,
            "expressionLevel": 0.7,
            "expressionLabel": "MED",
            "chromosome"    : "I",
            "description"   : product,
            "functions"     : [product] if product else [],
            "rna"           : "",
            "organism"      : "",
        })
    genes.sort(key=lambda g: g["startPos"])
    return genes


# ════════════════════════════════════════════════════════════════
# 엔드포인트
# ════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Genome Annotation API"}


@app.post("/upload")
async def upload_fasta(
    file: UploadFile = File(...),
    strain_name: Optional[str] = Form(None),
):
    """
    FASTA 파일을 받아 Bakta API에 제출하고 job_id 반환.
    프론트엔드는 이 job_id로 /status, /result를 폴링합니다.
    """
    content = await file.read()
    if not content:
        raise HTTPException(400, "파일이 비어있습니다.")

    # ── Bakta에 제출 ──────────────────────────────────────────
    async with httpx.AsyncClient(timeout=60) as client:
        # 초기화 (빈 config로 job 생성)
        init_resp = await client.post(
            f"{BAKTA_BASE}/job/init",
            json={
                "name"            : strain_name or file.filename or "genome",
                "repliconTableType": "CSV",
            },
            headers={"Content-Type": "application/json"},
        )
        if init_resp.status_code != 200:
            raise HTTPException(502,
                f"Bakta init 실패: {init_resp.status_code} — {init_resp.text[:200]}")

        init_data = init_resp.json()
        job_id    = init_data["jobID"]
        up_url    = init_data["uploadURL"]

        # FASTA 파일 업로드 (Bakta가 제공한 pre-signed URL)
        up_resp = await client.put(
            up_url,
            content=content,
            headers={"Content-Type": "application/octet-stream"},
        )
        if up_resp.status_code not in (200, 204):
            raise HTTPException(502,
                f"Bakta 파일 업로드 실패: {up_resp.status_code}")

        # 분석 시작
        start_resp = await client.post(
            f"{BAKTA_BASE}/job/start",
            json={
                "jobID" : job_id,
                "config": {
                    "completeGenome"  : False,
                    "prodigalTrainingFile": None,
                    "translationTable"   : 11,
                    "dermType"           : "UNKNOWN",
                    "minContigLength"    : 200,
                    "locus"              : "BAKTA",
                    "locusTag"           : None,
                    "genus"              : None,
                    "species"            : None,
                    "strain"             : strain_name or "",
                    "plasmid"            : None,
                    "gram"               : "?",
                },
            },
        )
        if start_resp.status_code != 200:
            raise HTTPException(502,
                f"Bakta 분석 시작 실패: {start_resp.status_code} — {start_resp.text[:200]}")

    return {
        "job_id"    : job_id,
        "status"    : "RUNNING",
        "message"   : "Bakta 분석 제출 완료. /status/{job_id}로 상태를 확인하세요.",
    }


@app.get("/status/{job_id}")
async def check_status(job_id: str):
    """Bakta 작업 상태 확인."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{BAKTA_BASE}/job/{job_id}/status")
        if resp.status_code != 200:
            raise HTTPException(502, f"상태 확인 실패: {resp.status_code}")
        data = resp.json()

    # Bakta 상태: INIT | RUNNING | SUCCESSFUL | ERROR
    status = data.get("status", "RUNNING")
    return {
        "job_id" : job_id,
        "status" : status,
        "done"   : status == "SUCCESSFUL",
        "error"  : status == "ERROR",
    }


@app.get("/result/{job_id}")
async def get_result(job_id: str):
    """
    Bakta 결과를 다운로드하여 내부 detectedGenes 포맷으로 변환해 반환.
    프론트엔드의 analysisData.detectedGenes에 병합됩니다.
    """
    async with httpx.AsyncClient(timeout=60) as client:
        # 결과 URL 목록
        result_resp = await client.get(f"{BAKTA_BASE}/job/{job_id}/result")
        if result_resp.status_code != 200:
            raise HTTPException(502, f"결과 조회 실패: {result_resp.status_code}")
        result_data = result_resp.json()

        # JSON 결과 우선, 없으면 GFF3
        json_url = result_data.get("ResultFiles", {}).get("json")
        gff_url  = result_data.get("ResultFiles", {}).get("gff3")

        genome_len = 0
        genes      = []

        if json_url:
            json_resp = await client.get(json_url)
            if json_resp.status_code == 200:
                bakta_json = json_resp.json()
                genome_len = sum(
                    s.get("length", 0)
                    for s in bakta_json.get("sequences", [])
                )
                features = bakta_json.get("features", [])
                genes = parse_bakta_features(features, genome_len)

        elif gff_url:
            gff_resp = await client.get(gff_url)
            if gff_resp.status_code == 200:
                genes = parse_gff3(gff_resp.text, genome_len)

    # 통계
    trna_count   = sum(1 for g in genes if g["type"] == "rrna" and "tRNA" in g.get("fullName",""))
    rrna_count   = sum(1 for g in genes if g["type"] == "rrna" and "rRNA" in g.get("fullName",""))
    resist_count = sum(1 for g in genes if g["type"] == "antibiotic_resistance")
    vir_count    = sum(1 for g in genes if g["type"] == "virulence")

    return {
        "job_id"         : job_id,
        "detectedGenes"  : genes,
        "geneCount"      : len(genes),
        "trnaCount"      : trna_count,
        "rrnaCount"      : rrna_count,
        "resistanceGenes": resist_count,
        "virulenceGenes" : vir_count,
        "genomeLength"   : genome_len,
        "source"         : "bakta",
    }


# ── 직접 실행 ─────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("genome_api:app", host="0.0.0.0", port=8000, reload=True)
