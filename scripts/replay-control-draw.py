# Scrambled-seed control, the draw (audit/replay-control-protocol.md). 0 Qloo calls; reads the frozen replay files only.
# Run scripts/replay-control-tags.ts first. Cases in file order, v1's scored cases then v2's. Shuffle with random.Random(20261022) until every case's scrambled
# seed passes the three rules below, then write audit/replay-control-draw.json.
#   python3 -I scripts/replay-control-draw.py
import json, random

cases = [c for f in ("audit/replay.json", "audit/replay-v2.json") for c in json.load(open(f))["cases"] if c.get("result", {}).get("state") == "scored"]
# a seed's own Qloo tags: the first twelve on its cached search result (scripts/replay-control-tags.ts, 0 calls), plus
# the tag of any case where that brand is itself the real partner
known_tag = {k: set(v or []) for k, v in json.load(open("audit/replay-control-seed-tags.json")).items()}
for c in cases:
    known_tag.setdefault(c["partnerId"], set()).add(c["tag"]["id"])

def ok(case, donor):
    eight = {case["partnerId"], *(d["id"] for d in case["decoys"])}
    return (donor["seedId"] != case["seedId"]  # 1. no case keeps its own seed (by id: Doritos is the seed twice)
        and donor["seedId"] not in eight  # 2. the scrambled seed is not one of the eight it scores
        and donor["tag"]["id"] != case["tag"]["id"]  # 3a. the scrambled seed's own real deal is not in this aisle
        and case["tag"]["id"] not in known_tag.get(donor["seedId"], set()))  # 3b. nor does it carry this tag itself

rng = random.Random(20261022)
order, draws = list(range(len(cases))), 0
while True:
    rng.shuffle(order)
    draws += 1
    if all(ok(cases[i], cases[order[i]]) for i in range(len(cases))):
        break

rows = [{"case": f'{c["seed"]} x {c["partner"]}', "test": "v1" if i < 9 else "v2", "tag": c["tag"]["name"], "seed": c["seedMatched"], "scrambledSeed": cases[order[i]]["seedMatched"], "scrambledSeedId": cases[order[i]]["seedId"]} for i, c in enumerate(cases)]
json.dump({"rng": "python random.Random(20261022), list.shuffle, redrawn until valid", "draws": draws, "cases": rows}, open("audit/replay-control-draw.json", "w"), indent=2)
open("audit/replay-control-draw.json", "a").write("\n")
print(f"{draws} draws")
for r in rows:
    print(f'{r["case"]:40} {r["tag"]:32} -> {r["scrambledSeed"]}')
