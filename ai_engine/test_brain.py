import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine, json

tests = [
    "During maintenance of the compressor, technician started opening the flange before confirming zero pressure.",
    "Worker was doing grinding near the tank without a hot work permit and no fire watch was present.",
    "Worker entered a confined space without gas testing and without verifying isolation.",
    "दुर्घटना निकट सीमित स्थान में गैस परीक्षण के बिना प्रवेश किया।",  # near miss entry in confined space without gas test (Hindi)
    "Operators used a crane to lift the pump skid while a worker stood directly under the suspended load in the line of fire.",
    "A technician bypassed the safety interlock on the compressor to keep it running.",
    "Seat belts not worn by drivers during night transportation journey, speeding observed.",
    "Worker almost struck by suspended load during lifting operations.",
]

for t in tests:
    res = engine.analyze(t)
    print("=" * 80)
    print("TEXT:", t[:80])
    print("LANG:", res["language"], "| TRANSLATED:", res["translated_text"][:80])
    print("SIF:", res["sif"]["prediction"], "conf", res["sif"]["confidence"], res["sif"]["risk_level"], "score", res["sif"]["risk_score"])
    print("LSR:", [(l["rule"], l["confidence"], l["primary"]) for l in res["lsr"]])
    print("ACTIVITY:", res["activity"], "| HAZARDS:", res["hazards"], "| BARRIERS:", res["barrier_failures"])
    print("CONSEQ:", res["potential_consequence"], "| ROOT:", res["root_cause"])

print("=" * 80)
r1 = engine.analyze("Worker opened flange before zero energy verification. Stored pressure present.")
sim = engine.similarity_search("stored energy exposure during maintenance", [
    {"id": 1, "text": "Technician opening flange without verifying zero energy, residual pressure present."},
    {"id": 2, "text": "Housekeeping issue: oil spill in workshop, slip hazard."},
    {"id": 3, "text": "Grinding work without permit near hydrocarbon tank."},
], limit=5)
print("SIMILAR:", sim)

print("\nCO-PILOT TEST:")
print(engine.copilot("Which site has the highest SIF precursor density?", {"reports": [
    {"site": "Site-A", "sif_potential": 1, "activity": "Maintenance", "barrier_failure": "Energy Isolation", "created_at": "2026-08-01T10:00:00"},
    {"site": "Site-B", "sif_potential": 0, "activity": "Lifting", "barrier_failure": "Permit Verification", "created_at": "2026-08-01T11:00:00"},
] , "contractors": [{"name": "A", "score": 91}], "actions": [], "alerts": [], "interventions": []})["answer"])