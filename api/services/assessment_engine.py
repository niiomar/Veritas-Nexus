"""Server-side authenticity scoring.

This is a faithful port of the frontend's former AssessmentEngine.evaluate
(frontend/src/services/assessment.ts). It used to run entirely in the
browser, which meant the trust verdict for a piece of forensic evidence
could be recomputed - or spoofed - by anyone with devtools open, and it
quietly drifted out of sync with the backend's own C2PA status values (see
the INVALID/BROKEN_SIGNATURE mismatch this replaced). It now runs once,
server-side, at analysis completion time, and the frontend just renders the
stored result.

Deliberately kept as a line-for-line port, bugs and all (e.g. a failed EXIF
extraction still scores "metadata present" in the Metadata Integrity domain
because the original only checked for the *presence* of the exif dict, not
its status) - this is a straight relocation of existing behavior, not a
redesign.
"""
from typing import Any, Dict, List, Optional

Evidence = Dict[str, Any]


def evaluate_assessment(ai_report: Dict[str, Any], exif: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if ai_report.get("platform_status") == "REJECTED":
        return {
            "verdict": "REJECTED",
            "conf": "N/A",
            "type": "neutral",
            "msg": "System Gatekeeper Activated",
            "policy": "Format Rejection",
            "domains": [],
            "totalScore": 0,
        }

    prob = ai_report.get("deepfake_probability")
    c2pa = ai_report.get("c2pa_data") or {}
    exif = exif or {}
    anomalies = exif.get("anomalies") or {}
    fingerprint = exif.get("fingerprint") or {}
    extended = exif.get("extended") or {}

    # Domain 1: Cryptographic Provenance (Max 30) - Pure Additive
    prov_ev: List[dict] = []
    if c2pa.get("is_signed"):
        status = c2pa.get("status")
        if status == "VALID":
            prov_score = 30
            prov_ev.append({"text": "Valid C2PA Manifest & Signature", "effect": "Positive", "pts": 30})
        elif status == "INVALID":
            prov_score = 0
            prov_ev.append({"text": "Signature Tampered / Broken", "effect": "Negative", "pts": 0})
        else:
            prov_score = 15
            prov_ev.append({"text": "Partial/Invalid C2PA Manifest", "effect": "Warning", "pts": 15})
    else:
        prov_score = 0
        prov_ev.append({"text": "No Cryptographic Signature", "effect": "Neutral", "pts": 0})

    # Domain 2: AI Authenticity (Max 25) - Pure Additive
    ai_ev: List[dict] = []
    if prob is not None:
        if prob < 0.15:
            ai_score = 25
            ai_ev.append({"text": "ViT Inference: Clean (No anomalies)", "effect": "Positive", "pts": 25})
        elif prob < 0.40:
            ai_score = 15
            ai_ev.append({"text": "ViT Inference: Minor artifacts", "effect": "Warning", "pts": 15})
        elif prob < 0.70:
            ai_score = 5
            ai_ev.append({"text": "ViT Inference: Suspicious regions", "effect": "Warning", "pts": 5})
        else:
            ai_score = 0
            ai_ev.append({"text": "ViT Inference: Synthetic/Deepfake", "effect": "Negative", "pts": 0})
    else:
        ai_score = 0
        ai_ev.append({"text": "Inference Unavailable (Faceless)", "effect": "Neutral", "pts": 0})

    # Domain 3: Metadata Integrity (Max 15) - Pure Additive
    meta_ev: List[dict] = []
    if exif and not anomalies.get("likely_stripped"):
        meta_score = 5
        meta_ev.append({"text": "EXIF Profile Present", "effect": "Positive", "pts": 5})
        if anomalies.get("gps_present"):
            meta_score += 5
            meta_ev.append({"text": "GPS Coordinates Embedded", "effect": "Positive", "pts": 5})
        else:
            meta_ev.append({"text": "No GPS Data", "effect": "Neutral", "pts": 0})
        if anomalies.get("makernotes_present"):
            meta_score += 5
            meta_ev.append({"text": "Raw MakerNotes Intact", "effect": "Positive", "pts": 5})
        else:
            meta_ev.append({"text": "No MakerNotes", "effect": "Neutral", "pts": 0})
    else:
        meta_score = 0
        meta_ev.append({"text": "Metadata Completely Stripped", "effect": "Negative", "pts": 0})

    # Domain 4: Structural Consistency (Max 15) - Pure Additive
    struct_score = 0
    struct_ev: List[dict] = []
    if anomalies:
        if anomalies.get("ela_anomaly"):
            struct_ev.append({"text": "Error Level Analysis (ELA) Mismatch", "effect": "Negative", "pts": 0})
        else:
            struct_score += 7
            struct_ev.append({"text": "Error Level Analysis Consistent", "effect": "Positive", "pts": 7})

        if anomalies.get("double_compression"):
            struct_ev.append({"text": "Double JPEG Compression", "effect": "Warning", "pts": 0})
        else:
            struct_score += 4
            struct_ev.append({"text": "Standard Compression Cycle", "effect": "Positive", "pts": 4})

        if anomalies.get("color_profile_mismatch"):
            struct_ev.append({"text": "Color Profile Mismatch", "effect": "Warning", "pts": 0})
        else:
            struct_score += 4
            struct_ev.append({"text": "Color Profile Matches Standard", "effect": "Positive", "pts": 4})
    else:
        struct_score = 5
        struct_ev = [{"text": "Insufficient Structural Data", "effect": "Neutral", "pts": 5}]

    # Domain 5: Chain of Custody (Max 10) - Pure Additive
    coc_score = 0
    coc_ev: List[dict] = []
    if anomalies:
        if anomalies.get("likely_exported"):
            coc_ev.append({"text": f"Export Pipeline: {fingerprint.get('software') or 'Unknown'}", "effect": "Warning", "pts": 0})
        else:
            coc_score += 5
            coc_ev.append({"text": "No Destructive Exports Detected", "effect": "Positive", "pts": 5})

        if anomalies.get("social_media_origin"):
            coc_ev.append({"text": "Social Media Platform Origin", "effect": "Warning", "pts": 0})
        else:
            coc_score += 5
            coc_ev.append({"text": "Direct/Native Origin Implied", "effect": "Positive", "pts": 5})
    else:
        coc_score = 0
        coc_ev = [{"text": "Custody Traces Unavailable", "effect": "Neutral", "pts": 0}]

    # Domain 6: Contextual Correlation (Max 5) - Pure Additive
    corr_score = 0
    corr_ev: List[dict] = []

    make = fingerprint.get("make")
    if make and make != "Unknown":
        corr_score += 2
        corr_ev.append({"text": f"Hardware Sensor Identified: {make}", "effect": "Positive", "pts": 2})
    else:
        corr_ev.append({"text": "Hardware Sensor Not Identified", "effect": "Neutral", "pts": 0})

    if extended.get("phash"):
        corr_score += 3
        corr_ev.append({"text": "Visual DNA (pHash) Extracted", "effect": "Positive", "pts": 3})
    else:
        corr_ev.append({"text": "No Visual DNA (pHash) Extracted", "effect": "Neutral", "pts": 0})

    total_score = prov_score + ai_score + meta_score + struct_score + coc_score + corr_score

    # Verdict logic
    has_major_contradiction = bool(c2pa.get("is_signed") and c2pa.get("status") == "VALID" and prob is not None and prob > 0.70)
    is_crit = bool((prob is not None and prob > 0.70) or c2pa.get("status") == "INVALID")

    if has_major_contradiction:
        verdict, kind, msg = "CONFLICT", "review", "Evidence Contradicts"
    elif is_crit:
        verdict, kind, msg = "CRITICAL", "crit", "Likely Manipulated"
    elif total_score >= 75:
        verdict, kind, msg = "VERIFIED", "trust", "Authenticity Established"
    elif total_score >= 40:
        verdict, kind, msg = "UNVERIFIED", "neutral", "Insufficient Provenance"
    else:
        verdict, kind, msg = "INCONCLUSIVE", "review", "Low Integrity Score"

    return {
        "verdict": verdict,
        "conf": f"{total_score:.1f}",
        "type": kind,
        "msg": msg,
        "policy": "Weighted_XAI_v4.7",
        "domains": [
            {"name": "Cryptographic Provenance", "score": prov_score, "max": 30, "weight": 30, "evidence": prov_ev},
            {"name": "AI Authenticity", "score": ai_score, "max": 25, "weight": 25, "evidence": ai_ev},
            {"name": "Metadata Integrity", "score": meta_score, "max": 15, "weight": 15, "evidence": meta_ev},
            {"name": "Structural Consistency", "score": struct_score, "max": 15, "weight": 15, "evidence": struct_ev},
            {"name": "Chain of Custody", "score": coc_score, "max": 10, "weight": 10, "evidence": coc_ev},
            {"name": "Contextual Correlation", "score": corr_score, "max": 5, "weight": 5, "evidence": corr_ev},
        ],
        "totalScore": total_score,
    }
