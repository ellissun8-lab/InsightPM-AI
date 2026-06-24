"""
从 overall.analysis.json 拆分出每个 segment 的 analysis.json。
保证 cluster_id、name、feedback_count、evidence_feedback_ids、priority、opportunity_score 完全一致。
"""
import argparse
import json
import os

parser = argparse.ArgumentParser()
parser.add_argument("--dataset", default="mixed-feedback")
parser.add_argument("--base-dir", default=None, help="Analysis base dir (default: fixtures/analysis)")
args_cli = parser.parse_args()

DATASET = args_cli.dataset
BASE = args_cli.base_dir or os.path.join(os.path.dirname(__file__), "..", "fixtures", "analysis")
OVERALL_JSON = os.path.join(BASE, f"{DATASET}.overall.analysis.json")
SEG_DIR = os.path.join(BASE, DATASET, "segments")
SEGMENTS_JSON = os.path.join(BASE, f"{DATASET}.segments.json")


def main():
    with open(OVERALL_JSON, "r", encoding="utf-8") as f:
        overall = json.load(f)

    with open(SEGMENTS_JSON, "r", encoding="utf-8") as f:
        seg_meta = json.load(f)

    # Group overall clusters by segment_id
    clusters_by_seg = {}
    for c in overall["issue_clusters"]:
        seg_id = c["segment_id"]
        if seg_id not in clusters_by_seg:
            clusters_by_seg[seg_id] = []
        clusters_by_seg[seg_id].append(c)

    # Build seg_meta lookup
    meta_lookup = {s["segment_id"]: s for s in seg_meta["segments"]}

    os.makedirs(SEG_DIR, exist_ok=True)

    for seg_id, clusters in clusters_by_seg.items():
        meta = meta_lookup.get(seg_id, {})
        seg_type = meta.get("segment_type", "unknown")

        # Compute summary
        total_fc = sum(c["feedback_count"] for c in clusters)
        total_evidence = sum(len(c.get("evidence_feedback_ids", [])) for c in clusters)

        seg_json = {
            "segment_id": seg_id,
            "segment_type": seg_type,
            "summary": {
                "feedback_count": total_fc,
                "cluster_count": len(clusters),
                "clustered_feedback_count": total_fc,
                "unclustered_feedback_count": 0,
            },
            "issue_clusters": clusters,  # Directly from overall, same data
        }

        out_path = os.path.join(SEG_DIR, f"{seg_id}.analysis.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(seg_json, f, ensure_ascii=False, indent=2)
        print(f"✅ {seg_id}.analysis.json: {len(clusters)} clusters, {total_fc} feedback")

    print(f"\n✨ 已从 overall JSON 拆分出 {len(clusters_by_seg)} 个 segment JSON")


if __name__ == "__main__":
    main()
