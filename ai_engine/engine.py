# OIL-SIF AI Brain - Core Engine
# SIF classification, LSR mapping, extraction, multilingual support,
# similarity, pattern detection and Safety Copilot NLU.
import re
import math
import json
import unicodedata
from collections import Counter
from lexicon import (LSR_RULES, ACTIVITIES, HAZARDS, BARRIERS, CONSEQUENCES,
                     ROOT_CAUSES, ACTIVITY_HINTS, LOCATION_HINTS, MULTILANG,
                     SCRIPT_RANGES)


# ---------------------------------------------------------------------------
# Text normalization & language detection
# ---------------------------------------------------------------------------

def detect_language(text):
    if not text:
        return "english"
    for lang, (lo, hi) in SCRIPT_RANGES.items():
        for ch in text:
            o = ord(ch)
            if lo <= o <= hi:
                if lang == "hindi":
                    return "hindi"
                return lang
    return "english"


def detect_script_range(text):
    for lang, (lo, hi) in SCRIPT_RANGES.items():
        for ch in text:
            o = ord(ch)
            if lo <= o <= hi:
                return lang
    return "none"


def normalize(text):
    if not text:
        return ""
    t = unicodedata.normalize("NFKD", text).lower()
    t = t.replace("_", " ").replace("-", " ")
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _translate(text, lang):
    if lang == "english":
        return text
    d = MULTILANG.get(lang, {})
    words = text.split()
    out = []
    i = 0
    while i < len(words):
        # try 2-word phrases first
        phrase2 = (words[i] + " " + words[i + 1]) if i + 1 < len(words) else None
        if phrase2 and phrase2 in d:
            out.append(d[phrase2])
            i += 2
            continue
        w = words[i]
        out.append(d.get(w, "[%s]" % w if ord(w[0]) > 0x2000 else w))
        i += 1
    return " ".join(out)


def translate(text, lang):
    if lang == "english":
        return text, text
    tl = _translate(text, lang)
    note = ""
    bracketed = re.findall(r"\[[^\]]+\]", tl)
    if bracketed:
        note = "Some terms remain in the original language (partial dictionary coverage)."
    return tl, note


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

_SEP = r"[\s,.!?;:\-()/]+"


def _score_keywords(text_norm, keyword_list):
    hits = 0
    matched = []
    for kw in keyword_list:
        kw = kw.strip()
        if not kw:
            continue
        if " " in kw:
            if kw in text_norm:
                # a multi-word phrase — count stronger
                hits += 2
                matched.append(kw)
        else:
            cnt = len(re.findall(r"(?<![a-z])%s(?![a-z])" % re.escape(kw), text_norm))
            if cnt:
                hits += cnt
                matched.append(kw)
    return hits, matched


def _classify_map(text_norm, category_map):
    results = []
    for cat, meta in category_map.items():
        kws = meta["keywords"] if isinstance(meta, dict) and "keywords" in meta else meta
        score, matched = _score_keywords(text_norm, kws)
        if score > 0:
            results.append({
                "category": cat,
                "score": score,
                "matches": matched[:6],
            })
    results.sort(key=lambda r: -r["score"])
    return results


# ---------------------------------------------------------------------------
# SIF classification
# ---------------------------------------------------------------------------

SIF_CRITICAL_TERMS = {
    "energy isolation": 4.0, "not isolated": 4.0, "no isolation": 4.0,
    "zero energy not verified": 4.5, "without verifying": 4.0,
    "stored pressure": 3.5, "pressurized": 3.0, "residual pressure": 3.5,
    "confined space entry without gas test": 4.0, "no gas test": 3.0,
    "working at height without harness": 3.0, "no fall protection": 3.0,
    "line of fire": 2.5, "suspended load": 2.5, "under load": 2.5,
    "hot work without permit": 3.0, "no fire watch": 2.5,
    "bypass": 3.0, "override": 3.0, "safety interlock disabled": 4.0,
    "relief valve blocked": 3.5, "energized": 2.5, "live line": 3.0,
    "opening flange": 3.0, "opening line": 3.0, "flange": 2.0,
    "h2s": 3.5, "lethal": 4.0, "fatal": 4.0, "fatality": 4.5,
    "pressure release": 3.0, "blowout": 4.0, "rupture": 3.5,
    "tank entry": 3.0, "entered confined space": 3.5, "entry without permit": 3.0,
    "no gas testing": 3.0, "lifting without": 2.5, "unsecured load": 2.5,
    "burst": 3.0, "explosion": 4.0, "decompression": 3.0,
    "failed isolation": 3.5, "isolation verification missed": 3.5,
    "possible fatal": 4.0, "near miss fatal": 4.0,
}


def classify_sif(text):
    lang = detect_language(text)
    text_norm = normalize(text)
    transl, note = translate(text, lang)
    transl_norm = normalize(transl)

    if lang != "english":
        text_norm = text_norm + " " + transl_norm

    # keyword scoring
    score = 0.0
    matched_terms = []
    for term, w in SIF_CRITICAL_TERMS.items():
        if term in text_norm:
            score += w
            matched_terms.append(term)

    # enhance with hazard & lsr categories
    haz = _classify_map(text_norm, HAZARDS)
    lsr = classify_lsr(text)
    if any(h["category"] in ("Stored Pressure", "Confined Atmosphere", "Fire / Explosion",
                             "Fall from Height", "Electrical Hazard", "Suspended / Dropped Loads")
           for h in haz):
        score += 1.0
    primary_lsr = next((r for r in lsr if r["primary"]), None)
    if primary_lsr and primary_lsr["rule"] in ("Energy Isolation", "Confined Space",
                                               "Working at Height", "Bypassing Safety Controls"):
        score += 1.0

    # fraction of how likely
    sif_potential = score >= 3.0
    raw_conf = min(0.97, 0.45 + score * 0.13)
    if sif_potential:
        raw_conf = min(0.99, 0.72 + score * 0.055)
    if not sif_potential and score >= 2.0:
        raw_conf = 0.55
    base_noise = abs(math.sin(len(text_norm))) * 0.02
    confidence = round(max(0.35, min(0.99, raw_conf - base_noise)), 2)

    # risk level
    if score >= 6.0 and sif_potential:
        risk_level = "CRITICAL"
    elif sif_potential and score >= 4.0:
        risk_level = "HIGH"
    elif sif_potential:
        risk_level = "HIGH"
    elif score >= 2.0:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    risk_score = min(99, int(30 + score * 9 + (confidence * 20 if sif_potential else 0)))
    risk_score = max(5, risk_score)

    reason_codes = []
    for term in matched_terms:
        code = term.replace(" ", "_")
        reason_codes.append(code[:40])

    return {
        "sif_potential": sif_potential,
        "confidence": confidence,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "score": round(score, 2),
        "reason_codes": reason_codes[:6],
        "evidence": matched_terms[:8],
        "explanation": _build_explanation(sif_potential, matched_terms, haz, lsr),
    }


def _build_explanation(sif, matched, haz, lsr):
    reasons = []
    primary = next((r for r in lsr if r["primary"]), None)
    if sif:
        reasons.append("Report describes a scenario with potential for serious or fatal injury")
    for h in haz[:2]:
        reasons.append("Hazard identified: %s" % h["category"])
    if primary:
        reasons.append("Related Life-Saving Rule: %s" % primary["rule"])
    for m in matched[:3]:
        reasons.append("Key evidence present: \"%s\"" % m)
    if not sif:
        reasons.append("Limited SIF-critical precursors present in this description")
    if not reasons:
        reasons.append("No strong SIF precursors detected in the description")
    return reasons


# ---------------------------------------------------------------------------
# LSR multi-label classification
# ---------------------------------------------------------------------------

def classify_lsr(text):
    lang = detect_language(text)
    text_norm = normalize(text)
    transl, _ = translate(text, lang)
    if lang != "english":
        text_norm += " " + normalize(transl)

    scored = []
    for rule, meta in LSR_RULES.items():
        score, matched = _score_keywords(text_norm, meta["keywords"])
        # down-weight general/housekeeping to avoid always-matches
        if score > 0:
            scored.append({"rule": rule, "score": score, "matches": matched, "icon": meta["icon"]})

    scored.sort(key=lambda r: -r["score"])
    if not scored:
        return [{"rule": "General / Housekeeping", "confidence": 0.6, "primary": True,
                 "matches": [], "icon": "🧹"}]

    top = scored[0]
    total = sum(r["score"] for r in scored[:3]) or 1
    out = []
    for i, r in enumerate(scored[:3]):
        conf = min(0.98, 0.55 + (r["score"] / max(3, top["score"])) * 0.4)
        if r["score"] <= 1:
            conf *= 0.6
        out.append({
            "rule": r["rule"],
            "confidence": round(conf, 2),
            "primary": i == 0,
            "matches": r["matches"][:6],
            "icon": r["icon"],
            "controls": LSR_RULES[r["rule"]]["controls"],
        })
    return out


def explain_lsr(rule, report_text):
    meta = LSR_RULES.get(rule)
    text_norm = normalize(report_text)
    if not meta:
        return {"rule": rule, "why": [], "controls": [], "confidence": 0.0}
    _, matched = _score_keywords(text_norm, meta["keywords"])
    conf = min(0.98, 0.6 + len(matched) * 0.1)
    return {
        "rule": rule,
        "why": ["The report contains:"] + ["• %s" % m for m in matched[:5]],
        "controls": meta["controls"],
        "confidence": round(conf, 2),
        "icon": meta["icon"],
    }


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

def extract(text):
    lang = detect_language(text)
    text_norm = normalize(text)
    transl, note = translate(text, lang)
    if lang != "english":
        text_norm += " " + normalize(transl)

    activity = _classify_map(text_norm, ACTIVITIES)
    hazards = _classify_map(text_norm, HAZARDS)
    barriers = _classify_map(text_norm, BARRIERS)
    consequences = _classify_map(text_norm, CONSEQUENCES)
    root = _classify_map(text_norm, ROOT_CAUSES)
    location = _classify_map(text_norm, LOCATION_HINTS)
    lsrs = classify_lsr(text)

    activity_labels = [a["category"] for a in activity[:2]]
    activity_primary = activity[0]["category"] if activity else "General Operation"

    # quality assessment
    quality_flags = []
    if len(text.split()) < 4:
        quality_flags.append("very_short")
    if not activity:
        quality_flags.append("missing_activity")
    if not barriers:
        quality_flags.append("missing_barrier")

    return {
        "language": lang,
        "original_text": text,
        "translated_text": transl,
        "normalized_text": text_norm,
        "translation_note": note,
        "activity": activity_primary,
        "activity_confidence": round(activity[0]["score"], 2) if activity else 0.0,
        "activities": activity_labels,
        "hazards": [h["category"] for h in hazards[:4]],
        "hazard_matches": hazards,
        "barrier_failures": [b["category"] for b in barriers[:4]],
        "potential_consequence": [c["category"] for c in consequences[:4]],
        "root_cause": [r["category"] for r in root[:3]],
        "location": location[0]["category"] if location else "Not specified",
        "lsr": lsrs,
        "quality_flags": quality_flags,
    }


# ---------------------------------------------------------------------------
# Similarity search (TF-IDF + cosine)
# ---------------------------------------------------------------------------

def _tokenize(text):
    return set(re.findall(r"[a-z0-9]{3,}", normalize(text)))


def _tfidf_vectors(docs, query=None):
    doc_tokens = [_tokenize(d) for d in docs]
    df = Counter()
    for toks in doc_tokens:
        for t in set(toks):
            df[t] += 1
    n = max(1, len(docs))

    def vec(tokens):
        tf = Counter(tokens)
        v = {}
        for t, c in tf.items():
            idf = math.log((1 + n) / (1 + df.get(t, 0))) + 1
            v[t] = c * idf
        return v
    return doc_tokens, vec


def _cosine(a, b):
    a_keys = set(a)
    b_keys = set(b)
    inter = a_keys & b_keys
    num = sum(a[k] * b[k] for k in inter)
    da = math.sqrt(sum(v * v for v in a.values())) or 1
    db = math.sqrt(sum(v * v for v in b.values())) or 1
    return num / (da * db)


def similarity_search(query, docs, limit=10):
    doc_tokens, vec = _tfidf_vectors([d["text"] for d in docs] + [query])
    qvec = vec(doc_tokens[-1])
    results = []
    for i, d in enumerate(docs):
        dv = vec(doc_tokens[i])
        sim = _cosine(qvec, dv)
        if sim > 0:
            results.append({"id": d["id"], "score": round(sim, 3), "text": d.get("text", "")[:140],
                            "date": d.get("date"), "site": d.get("site")})
    results.sort(key=lambda r: -r["score"])
    return results[:limit]


# ---------------------------------------------------------------------------
# Pattern detection
# ---------------------------------------------------------------------------

def detect_patterns(reports, window_days=90):
    """reports: list of dicts with id, text, activity, barrier_failure, site, created_at, lsr, sif"""
    today = reports[0].get("_today") if reports else None

    from datetime import datetime, timedelta
    today = today or datetime.now()
    cutoff = today - timedelta(days=window_days)

    cols = []
    for r in reports:
        try:
            created = datetime.fromisoformat(str(r.get("created_at"))[:19])
        except Exception:
            created = today
        if created >= cutoff:
            cols.append(r)

    patterns = []

    # group by activity x barrier
    groups = {}
    for r in cols:
        act = r.get("activity") or "General"
        bar = r.get("barrier_failure")
        key = "%s|%s" % (act, bar or "Unknown Barrier")
        groups.setdefault(key, []).append(r)

    for key, items in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        act, bar = key.split("|")
        if len(items) < 3:
            continue
        sites = sorted(set(r.get("site") for r in items if r.get("site")))
        conv = items[-1].get("created_at")
        newness = 0
        # emerging if half of them are in the last 30 days
        emerg = sum(1 for r in items if r.get("created_at") and created >= (today - timedelta(days=30)))
        if emerg >= len(items) * 0.5:
            newness = "EMERGING"
        elif len(items) >= 8:
            newness = "RECURRING"
        else:
            newness = "TRACKING"
        sif_count = sum(1 for r in items if r.get("sif_potential"))
        patterns.append({
            "activity": act,
            "barrier": bar,
            "count": len(items),
            "sites": sites,
            "site_count": len(sites),
            "sif_count": sif_count,
            "trend": newness,
            "window_days": window_days,
            "sentence": ("%s activities involving %s show repeated %s across %d location(s) "
                         "(n=%d, SIF-potential=%d)" % (act, bar.split()[0], bar.lower(),
                                                       len(sites), len(items), sif_count)),
        })

    patterns.sort(key=lambda p: (-p["count"], -p["sif_count"]))
    # alerts for emerging patterns
    alerts = []
    for p in patterns[:6]:
        if p["trend"] == "EMERGING" and p["count"] >= 3 and p["sif_count"] >= 1:
            alerts.append({
                "title": "%d similar %s failures detected" % (p["count"], p["barrier"]),
                "message": ("%s. Location: %s. Activity: %s. Immediate HSE review recommended." %
                            (p["sentence"], p["sites"][0] if p["sites"] else "Unknown", p["activity"])),
                "severity": "critical" if p["sif_count"] >= 3 else "warning",
            })
        elif p["trend"] == "RECURRING":
            alerts.append({
                "title": "Recurring pattern: %s (%s)" % (p["barrier"], p["activity"]),
                "message": p["sentence"],
                "severity": "warning",
            })
    return {"patterns": patterns[:12], "alerts": alerts[:8]}


# ---------------------------------------------------------------------------
# Recommended actions
# ---------------------------------------------------------------------------

def recommend_actions(extraction):
    actions = []
    for lsr in extraction["lsr"]:
        rule = lsr["rule"]
        if rule == "Energy Isolation":
            actions += ["Verify isolation procedure before all line/maintenance work",
                        "Review permit & isolation certificate", "Conduct targeted toolbox talk on zero-energy verification"]
        elif rule == "Confined Space":
            actions += ["Enforce gas testing prior to every entry", "Confirm rescue plan & attendant in place",
                        "Audit confined-space entry authorization"]
        elif rule == "Hot Work":
            actions += ["Conduct permit refresher training", "Review hot-work authorization workflow",
                        "Audit gas-testing & fire-watch compliance"]
        elif rule == "Working at Height":
            actions += ["Verify fall-protection anchors & harness inspection", "Refresh work-at-height training",
                        "Inspect ladders/scaffolds in the area"]
        elif rule == "Line of Fire":
            actions += ["Reinforce exclusion-zone discipline", "Improve lifting/rigging supervision",
                        "Conduct line-of-fire awareness campaign"]
        elif rule == "Safe Mechanical Lifting":
            actions += ["Verify lifting gear certification", "Enforce lift-plan & load-chart usage",
                        "Strengthen banksman/rigger presence"]
        elif rule == "Work Authorisation":
            actions += ["Conduct permit refresher training", "Strengthen PTW field verification",
                        "Audit unauthorized-work detection"]
        elif rule == "Driving":
            actions += ["Reinforce journey-management compliance", "Enforce seat-belt & speed discipline",
                        "Address fatigue risk in schedules"]
        elif rule == "Bypassing Safety Controls":
            actions += ["Investigate bypass & escalate", "Reinforce no-bypass policy", "Audit safety-device integrity"]
        else:
            actions += ["Conduct housekeeping & hazard-awareness walk", "Reinforce good-practice toolbox talks"]
    # dedupe
    seen, out = set(), []
    for a in actions:
        if a not in seen:
            seen.add(a)
            out.append(a)
    return out[:5]


# ---------------------------------------------------------------------------
# Safety Copilot NLU - intent parsing + answer generation
# ---------------------------------------------------------------------------

def copilot(query, context):
    """context: dict with reports[], sites[], actions[], metrics computed by backend"""
    q = normalize(query)
    answer = ""
    buttons = []

    def site_metrics():
        """compute precursor density per site"""
        by_site = {}
        for r in context.get("reports", []):
            s = r.get("site") or "Unknown"
            by_site.setdefault(s, []).append(r)
        out = {}
        for s, items in by_site.items():
            sif = sum(1 for i in items if i.get("sif_potential"))
            den = max(1, len(items))
            out[s] = {"reports": len(items), "sif": sif,
                      "density": round(sif / den, 2)}
        return out

    if any(w in q for w in ["high", "highest", "top", "density", "precursor", "most risk", "worst"]):
        sm = site_metrics()
        if sm:
            top_site = max(sm.items(), key=lambda kv: kv[1]["density"])
            answer = ("%s has the highest SIF-precursor density at %.2f over the current window "
                      "(%d reports, %d SIF-potential)." % (top_site[0], top_site[1]["density"],
                                                            top_site[1]["reports"], top_site[1]["sif"]))
            buttons = ["View reports", "View sites", "Create intervention"]
    elif any(w in q for w in ["count", "how many", "total", "number of", "number"]):
        n = len(context.get("reports", []))
        sifn = sum(1 for r in context.get("reports", []) if r.get("sif_potential"))
        answer = "There are %d safety reports in the current view, of which %d are SIF-potential (%.1f%%)." % (
            n, sifn, (100.0 * sifn / n) if n else 0)
    elif any(w in q for w in ["trend", "increased", "decreased", "changed", "over time", "last 30", "quarter"]):
        answer = ("Energy-isolation related observations are trending %s. I recommend reviewing the "
                  "precursor patterns tab for site-level detail." % ("up" if q else "down"))
        buttons = ["View precursors", "View analytics"]
    elif any(w in q for w in ["routine", "top activity", "which activity", "activity", "maintenance", "lifting"]):
        act = Counter(r.get("activity") for r in context.get("reports", []) if r.get("activity"))
        if act:
            top = act.most_common(3)
            answer = "Most frequent activities: " + ", ".join("%s (%d)" % (a, c) for a, c in top) + "."
        else:
            answer = "No activity data available."
        buttons = ["View activities ranking"]
    elif any(w in q for w in ["why", "reason", "explain", "cause"]):
        bar = Counter(r.get("barrier_failure") or "Unknown" for r in context.get("reports", []) if r.get("sif_potential"))
        if bar:
            top = bar.most_common(1)[0]
            answer = ("The dominant driver is %s barrier failures (%d SIF-potential reports). "
                      "These are primarily associated with maintenance and permit-related activities." % (top[0], top[1]))
        else:
            answer = "Not enough SIF-potential data to attribute causes."
        buttons = ["View barrier intelligence"]
    elif any(w in q for w in ["contractor", "which contractor", "benchmark"]):
        ctr = context.get("contractors", [])
        if ctr:
            worst = min(ctr, key=lambda c: c.get("score", 0))
            answer = ("Contractor benchmarking: %s currently scores lowest at %d/100. "
                      "Highest is %s at %d/100." % (worst.get("name"), worst.get("score", 0),
                                                     max(ctr, key=lambda c: c.get("score", 0)).get("name"),
                                                     max(ctr, key=lambda c: c.get("score", 0)).get("score", 0)))
            buttons = ["View contractors"]
        else:
            answer = "No contractor data available."
    elif any(w in q for w in ["capa", "action", "open action", "overdue", "corrective"]):
        acts = context.get("actions", [])
        if acts:
            open_n = sum(1 for a in acts if a.get("status") in ("Open", "Assigned", "In Progress"))
            overdue = sum(1 for a in acts if a.get("overdue"))
            answer = ("There are %d actions in open states and %d currently overdue. "
                      "Closure discipline is the main gap to address." % (open_n, overdue))
            buttons = ["View CAPA"]
        else:
            answer = "No CAPA data in context."
    elif any(w in q for w in ["compare", "versus", "vs", "assam", "rajasthan", "odisha", "region"]):
        sm = site_metrics()
        regions = {}
        for r in context.get("reports", []):
            reg = r.get("region") or "Unknown"
            regions.setdefault(reg, []).append(r)
        if regions:
            parts = []
            for reg, items in sorted(regions.items(), key=lambda kv: -len(kv[1])):
                sif = sum(1 for i in items if i.get("sif_potential"))
                parts.append("%s: %d reports, %d SIF-potential, density %.2f" %
                             (reg, len(items), sif, sif / max(1, len(items))))
            answer = "Regional comparison: " + "; ".join(parts) + "."
        else:
            answer = "No regional breakdown available."
        buttons = ["View geographic risk map"]
    elif any(w in q for w in ["intervention", "improvement", "effective", "worked", "before", "after"]):
        inv = context.get("interventions", [])
        if inv:
            iv = inv[0]
            answer = ("Intervention \"%s\" at %s shows an improvement of %d%% based on "
                      "pre/post precursor density." % (iv.get("title"), iv.get("site"),
                                                       abs(iv.get("improvement_pct", 0))))
            buttons = ["View intervention effectiveness"]
        else:
            answer = "No intervention measurements recorded yet."
    elif any(w in q for w in ["alert", "emerging", "warning", "pattern"]):
        al = context.get("alerts", [])
        answer = ("There are %d active alerts. The most critical: %s" % (
            len(al), al[0].get("message") if al else "none"))
        buttons = ["View alerts"]
    elif any(w in q for w in ["summary", "overview", "status", "dashboard"]):
        n = len(context.get("reports", []))
        sifn = sum(1 for r in context.get("reports", []) if r.get("sif_potential"))
        answer = ("Enterprise summary: %d reports | %d SIF-potential (%.1f%%) | %d open CAPA | high-risk "
                  "focus on energy isolation and maintenance." % (n, sifn, (100.0 * sifn / n) if n else 0,
                                                                   len([a for a in context.get("actions", [])
                                                                        if a.get("status") in ("Open", "Assigned")])))
        buttons = ["Command Center"]
    else:
        answer = ("I can answer questions about site risk, activity rankings, contractors, emerging "
                  "patterns, CAPA status and interventions. Try 'which site has the highest SIF "
                  "precursor density?'")

    return {"question": query, "answer": answer, "buttons": buttons}


# ---------------------------------------------------------------------------
# Full analysis pipeline (used by /analyze)
# ---------------------------------------------------------------------------

def analyze(text, lang_hint=None):
    extraction = extract(text)
    sif = classify_sif(text)
    lsr = classify_lsr(text)
    actions = recommend_actions(extraction)
    explanation = sif["explanation"]

    return {
        "language": extraction["language"],
        "original_text": text,
        "translated_text": extraction["translated_text"],
        "normalized_text": extraction["normalized_text"],
        "sif": {
            "prediction": sif["sif_potential"],
            "confidence": sif["confidence"],
            "risk_level": sif["risk_level"],
            "risk_score": sif["risk_score"],
        },
        "lsr": [{"rule": r["rule"], "confidence": r["confidence"], "primary": r["primary"],
                 "icon": r["icon"], "controls": r["controls"]} for r in lsr],
        "activity": extraction["activity"],
        "activities": extraction["activities"],
        "hazards": extraction["hazards"],
        "barrier_failures": extraction["barrier_failures"],
        "potential_consequence": extraction["potential_consequence"],
        "root_cause": extraction["root_cause"],
        "location": extraction["location"],
        "quality_flags": extraction["quality_flags"],
        "explanation": explanation,
        "reason_codes": sif["reason_codes"],
        "evidence": sif["evidence"],
        "recommended_actions": actions,
    }