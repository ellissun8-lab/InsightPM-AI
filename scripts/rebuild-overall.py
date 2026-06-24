"""
从 segment JSON 重建 overall JSON 和所有 Markdown。
segment JSON 为唯一数据源。
"""
import argparse
import json
import os

parser = argparse.ArgumentParser()
parser.add_argument("--dataset", default="mixed-feedback")
parser.add_argument("--base-dir", default=None, help="Analysis base dir (default: fixtures/analysis)")
parser.add_argument("--total-count", type=int, default=None, help="Override total feedback count (default: sum from segments)")
args_cli = parser.parse_args()

DATASET = args_cli.dataset
BASE = args_cli.base_dir or os.path.join(os.path.dirname(__file__), "..", "fixtures", "analysis")
SEG_DIR = os.path.join(BASE, DATASET, "segments")
SEGMENTS_JSON = os.path.join(BASE, f"{DATASET}.segments.json")
OVERALL_JSON = os.path.join(BASE, f"{DATASET}.overall.analysis.json")
OVERALL_MD = os.path.join(BASE, f"{DATASET}.overall.analysis.md")

STRONG_CLAIMS = {
    "明显流失风险": "可能增加流失风险，需结合实际续费数据验证",
    "严重流失风险": "可能增加流失风险，需结合实际续费数据验证",
    "极高流失风险": "可能增加流失风险，需结合实际续费数据验证",
    "严重影响": "可能影响",
    "极大影响": "可能影响",
    "致命问题": "关键问题",
    "致命缺陷": "关键缺陷",
    "必然导致": "可能导致",
    "一定会": "可能会",
    "所有用户": "部分用户",
    "全部用户": "部分用户",
}

def weaken(text):
    for s, w in STRONG_CLAIMS.items():
        text = text.replace(s, w)
    return text


def dampened_score(cluster):
    """Cap opportunity_score for low-evidence clusters."""
    fc = cluster.get("feedback_count", 0)
    score = cluster.get("opportunity_score", 0)
    if fc <= 2 and score > 65:
        return 65
    if fc == 3 and score > 75:
        return 75
    return score


def canonicalize_cluster_id(cluster_id: str, segment_id: str, segment_type: str) -> str:
    """将 cluster_id 归一化为标准格式。
    业务 segment: {segment_id}-cluster-{NNN}
    非业务 segment: {segment_id}-cluster-{NNN}
    """
    import re
    cid = cluster_id
    prefix = segment_id + "-"
    # 剥离所有 segment_id 前缀
    while cid.startswith(prefix):
        cid = cid[len(prefix):]
    # cid 现在应该是 cluster-001 之类
    return f"{segment_id}-{cid}"


# ===== Step 1: Rebuild overall JSON from segment JSONs =====

def rebuild_overall_json():
    with open(SEGMENTS_JSON, "r", encoding="utf-8") as f:
        seg_meta = json.load(f)

    # Read all segment JSONs
    segment_data = {}
    for fname in sorted(os.listdir(SEG_DIR)):
        if not fname.endswith(".analysis.json"):
            continue
        with open(os.path.join(SEG_DIR, fname), "r", encoding="utf-8") as f:
            data = json.load(f)
        segment_data[data["segment_id"]] = data

    # Build global cluster list with globally unique cluster_ids
    all_clusters = []
    for seg in seg_meta["segments"]:
        seg_id = seg["segment_id"]
        seg_type = seg.get("segment_type", "unknown")
        sd = segment_data.get(seg_id)
        if not sd:
            continue
        for c in sd["issue_clusters"]:
            local_id = c["cluster_id"]
            global_id = canonicalize_cluster_id(local_id, seg_id, seg_type)
            cluster_entry = {
                "cluster_id": global_id,
                "segment_id": seg_id,
                "name": c["name"],
                "summary": c["summary"],
                "feedback_count": c["feedback_count"],
                "evidence_feedback_ids": c.get("evidence_feedback_ids", []),
                "secondary_themes": c.get("secondary_themes", []),
                "possible_metrics": c.get("possible_metrics", []),
                "priority": c.get("priority", "P2"),
                "opportunity_score": c.get("opportunity_score", 0),
                "recommendation": c.get("recommendation", ""),
            }
            # Propagate confidence flags
            if c.get("low_confidence"):
                cluster_entry["low_confidence"] = True
            if c.get("needs_validation"):
                cluster_entry["needs_validation"] = True
            if c.get("confidence_note"):
                cluster_entry["confidence_note"] = c["confidence_note"]
            all_clusters.append(cluster_entry)

    # Build segments summary
    segments_summary = []
    for seg in seg_meta["segments"]:
        seg_id = seg["segment_id"]
        sd = segment_data.get(seg_id)
        cluster_ids = []
        if sd:
            seg_type = seg.get("segment_type", "unknown")
            for c in sd["issue_clusters"]:
                local_id = c["cluster_id"]
                cluster_ids.append(canonicalize_cluster_id(local_id, seg_id, seg_type))
        segments_summary.append({
            "segment_id": seg_id,
            "name": seg.get("name", seg_id),
            "feedback_count": seg.get("feedback_count", 0),
            "business_goal": seg.get("business_goal", "unknown"),
            "issue_cluster_ids": cluster_ids,
        })

    # Compute summary
    total_feedback = args_cli.total_count or sum(s.get("feedback_count", 0) for s in seg_meta["segments"])
    biz_segs = [s for s in seg_meta["segments"] if s.get("segment_type") == "business"]
    noise_segs = [s for s in seg_meta["segments"] if s.get("segment_type") == "noise"]
    positive_segs = [s for s in seg_meta["segments"] if s.get("segment_type") == "positive"]
    unknown_segs = [s for s in seg_meta["segments"] if s.get("segment_type") == "unknown"]
    non_biz_count = len(noise_segs) + len(positive_segs) + len(unknown_segs)

    overall = {
        "project_id": "",
        "analysis_run_id": "",
        "summary": {
            "total_feedback_count": total_feedback,
            "analyzed_feedback_count": total_feedback,
            "clustered_feedback_count": total_feedback,
            "unclustered_feedback_count": 0,
            "unanalyzed_feedback_count": 0,
            "segment_count": len(seg_meta["segments"]),
            "business_segment_count": len(biz_segs),
            "noise_segment_count": len(noise_segs),
            "positive_segment_count": len(positive_segs),
            "unknown_segment_count": len(unknown_segs),
            "non_business_segment_count": non_biz_count,
            "cluster_count": len(all_clusters),
            "is_mixed_dataset": True,
        },
        "segments": segments_summary,
        "issue_clusters": all_clusters,
        "report_path": "fixtures/analysis/mixed-feedback.overall.analysis.md",
    }

    with open(OVERALL_JSON, "w", encoding="utf-8") as f:
        json.dump(overall, f, ensure_ascii=False, indent=2)
    print(f"✅ overall JSON rebuilt: {len(all_clusters)} clusters, {total_feedback} feedback")

    return overall, seg_meta, segment_data


# ===== Step 2: Render segment MDs =====

def render_business_segment_md(data, seg_meta_item):
    seg_id = data["segment_id"]
    summary = data["summary"]
    clusters = data["issue_clusters"]
    sorted_c = sorted(clusters, key=lambda c: dampened_score(c), reverse=True)
    n = len(clusters)

    lines = []
    lines.append(f"# 分组分析报告：{seg_id}")
    lines.append("")

    # 分析范围
    lines.append("## 分析范围")
    lines.append(f"- 分组 ID：{seg_id}")
    lines.append(f"- 分组类型：business")
    lines.append(f"- 业务目标：{seg_meta_item.get('business_goal', 'N/A')}")
    lines.append(f"- 反馈数量：{summary['feedback_count']}")
    lines.append(f"- 聚类数量：{summary['cluster_count']}")
    lines.append(f"- 已聚类反馈：{summary['clustered_feedback_count']}")
    lines.append(f"- 未聚类反馈：{summary['unclustered_feedback_count']}")
    lines.append("")

    # 核心结论
    lines.append("## 核心结论")
    top_n = min(3, n)
    if n <= 3:
        lines.append(f"本分组共识别 {n} 个问题，以下按机会分排序展示全部问题。")
    else:
        lines.append(f"本分组共识别 {n} 个问题，按机会分排序，Top {top_n} 问题为：")
    lines.append("说明：问题概览按机会分展示；资源投入优先级以 priority + evidence_weight 为准。")
    for i, c in enumerate(sorted_c[:top_n]):
        lines.append(f"{i+1}. **{c['name']}**（机会分 {dampened_score(c)}，{c['priority']}）— {weaken(c['summary'])}")
    lines.append("")

    # 高频问题概览
    lines.append("## 高频问题概览")
    lines.append("")
    if n <= 3:
        lines.append(f"说明：以下为本分组全部 {n} 个问题，按机会分降序排列。")
    else:
        lines.append(f"说明：以下为本分组全部 {n} 个问题，按机会分降序排列，其余问题见下方问题详情章节。")
    lines.append("")
    lines.append("| 排名 | 问题名称 | 反馈数 | 优先级 | 机会分 |")
    lines.append("| --- | --- | --- | --- | --- |")
    for i, c in enumerate(sorted_c):
        lines.append(f"| {i+1} | {c['name']} | {c['feedback_count']} | {c['priority']} | {dampened_score(c)} |")
    lines.append("")

    # 高优先级机会（按 priority + evidence_weight 排序）
    lines.append("## 高优先级机会")
    p0s = sorted([c for c in clusters if c.get("priority") == "P0"], key=lambda c: c.get("feedback_count", 0), reverse=True)
    p1s = sorted([c for c in clusters if c.get("priority") == "P1"], key=lambda c: c.get("feedback_count", 0), reverse=True)
    lines.append("")
    lines.append(f"说明：本节展示 P0 和 P1 级别问题，按优先级 + 证据权重排序。P0 为高证据、高影响的稳定问题（反馈数 ≥ 5）；P1 为需验证或中等证据的问题。P2 问题进入待办或验证池。")
    lines.append("")
    high_priority = p0s + p1s
    if high_priority:
        for c in high_priority:
            conf_tag = ""
            if c.get("low_confidence"):
                conf_tag = " [低置信度]"
            elif c.get("needs_validation"):
                conf_tag = " [需验证]"
            lines.append(f"### {c['name']}{conf_tag}")
            lines.append(f"- 机会分：{dampened_score(c)}")
            lines.append(f"- 优先级：{c['priority']}")
            lines.append(f"- 反馈数：{c['feedback_count']}")
            lines.append(f"- 摘要：{weaken(c['summary'])}")
            if c.get("confidence_note"):
                lines.append(f"- 置信度说明：{c['confidence_note']}")
            if c.get("possible_metrics"):
                lines.append(f"- 建议指标：{', '.join(c['possible_metrics'])}")
            lines.append("")
    else:
        lines.append("无 P0 或 P1 级别的问题。")
        lines.append("")

    # 问题详情
    lines.append("## 问题详情")
    for c in sorted_c:
        lines.append(f"### {c['name']}")
        lines.append(f"- 优先级：{c['priority']}")
        lines.append(f"- 机会分：{dampened_score(c)}")
        lines.append(f"- 反馈数：{c['feedback_count']}")
        lines.append(f"- 摘要：{weaken(c['summary'])}")
        if c.get("evidence_feedback_ids"):
            lines.append(f"- 证据反馈：{', '.join(c['evidence_feedback_ids'])}")
        if c.get("secondary_themes"):
            lines.append(f"- 次要主题：{', '.join(c['secondary_themes'])}")
        if c.get("possible_metrics"):
            lines.append(f"- 建议指标：{', '.join(c['possible_metrics'])}")
        if c.get("recommendation"):
            lines.append(f"- 建议：{weaken(c['recommendation'])}")
        lines.append("")

    # 建议行动
    lines.append("## 建议行动")
    def prio_sort_key_seg(c):
        prio_order = {"P0": 0, "P1": 1, "P2": 2}
        return (prio_order.get(c.get("priority", "P2"), 3), -c.get("feedback_count", 0))
    action_sorted = sorted(clusters, key=prio_sort_key_seg)
    for i, c in enumerate(action_sorted):
        action = "立即修复" if c["priority"] == "P0" else "改善体验" if c["priority"] == "P1" else "加入待办"
        lines.append(f"{i+1}. [{c['priority']}] **{c['name']}** — {action}")
        if c.get("recommendation"):
            lines.append(f"   - {weaken(c['recommendation'])}")
    lines.append("")

    # 风险提醒
    lines.append("## 风险提醒")
    p0_count = len(p0s)
    if p0_count > 0:
        lines.append(f"- 本分组有 {p0_count} 个 P0 级问题，需优先处理。")
    low_ev = [c for c in clusters if c.get("feedback_count", 0) < 3]
    if low_ev:
        names = ", ".join(c["name"] for c in low_ev)
        lines.append(f"- 以下问题反馈数较少（<3），结论置信度有限：{names}")
    lines.append("")

    # 需要进一步验证
    lines.append("## 需要进一步验证")
    low_ev = [c for c in clusters if c.get("feedback_count", 0) < 3]
    mid_ev = [c for c in clusters if 2 <= c.get("feedback_count", 0) <= 4]
    for c in low_ev:
        metrics = c.get("possible_metrics", [])
        metric_name = metrics[0] if metrics else "用户满意度"
        lines.append(f"- {c['name']}（{c['feedback_count']} 条反馈）：该问题是否在更多用户中集中出现？对{metric_name}的影响比例有多大？")
    for c in mid_ev:
        if c not in low_ev:
            metrics = c.get("possible_metrics", [])
            metric_name = metrics[0] if metrics else "用户满意度"
            lines.append(f"- {c['name']}（{c['feedback_count']} 条反馈）：该问题是否在特定场景下集中出现？对{metric_name}的影响有多大？")
    if not low_ev and not mid_ev:
        # Even if feedback is sufficient, check for business impact questions
        for c in sorted_c[:2]:
            metrics = c.get("possible_metrics", [])
            metric_name = metrics[0] if metrics else "用户满意度"
            lines.append(f"- {c['name']}：该问题对{metric_name}的实际影响比例是多少？是否需要优先投入资源？")
    lines.append("")

    # 给老板看的摘要（按 priority + evidence_weight 排序）
    # 排序规则：P0 > P1 > P2，同优先级内按 feedback_count 降序
    def prio_sort_key(c):
        prio_order = {"P0": 0, "P1": 1, "P2": 2}
        return (prio_order.get(c.get("priority", "P2"), 3), -c.get("feedback_count", 0))
    boss_sorted = sorted(clusters, key=prio_sort_key)

    lines.append("## 给老板看的摘要")
    lines.append("")
    lines.append("### 核心问题")
    for c in boss_sorted[:min(3, n)]:
        conf_tag = ""
        if c.get("low_confidence"):
            conf_tag = " [低置信度]"
        elif c.get("needs_validation"):
            conf_tag = " [需验证]"
        lines.append(f"- {c['name']}（{c['priority']}，机会分 {dampened_score(c)}，{c['feedback_count']} 条反馈）{conf_tag}")
    lines.append("")
    lines.append("### 直接后果")
    if boss_sorted:
        lines.append(f"- {weaken(boss_sorted[0]['summary'])}")
    else:
        lines.append("- 暂无具体问题数据。")
    lines.append("")
    lines.append("### 关键机会")
    # P0 先展示，再展示 P1（带置信度标签）
    shown = 0
    for c in p0s[:2]:
        lines.append(f"- {c['name']}：{weaken(c.get('recommendation', ''))}")
        shown += 1
    if shown < 2:
        for c in p1s[:2 - shown]:
            conf_tag = "（需验证）" if c.get("needs_validation") else "（低置信度）" if c.get("low_confidence") else ""
            lines.append(f"- {c['name']}{conf_tag}：{weaken(c.get('recommendation', ''))}")
    lines.append("")
    lines.append("### 建议")
    high_ev_p0 = [c for c in p0s if c.get("feedback_count", 0) >= 5]
    if high_ev_p0:
        lines.append(f"- 第一阶段优先处理 {len(high_ev_p0)} 个高证据 P0 问题")
    else:
        lines.append(f"- 当前无高证据 P0 问题，建议先验证 P1 问题后再决定优先级")
    if p1s:
        low_conf = [c for c in p1s if c.get("low_confidence") or c.get("needs_validation")]
        if low_conf:
            names = ", ".join(c["name"] for c in low_conf)
            lines.append(f"- 以下问题进入专项验证池：{names}")
    lines.append(f"- 本分组共 {summary['feedback_count']} 条反馈，覆盖 {n} 个问题")
    lines.append("")

    return lines


def render_nonbusiness_segment_md(data):
    seg_id = data["segment_id"]
    seg_type = data.get("segment_type", "unknown")
    summary = data["summary"]
    clusters = data["issue_clusters"]

    lines = []
    lines.append(f"# 分组分析报告：{seg_id}")
    lines.append("")
    lines.append("## 分析范围")
    lines.append(f"- 分组 ID：{seg_id}")
    lines.append(f"- 分组类型：{seg_type}")
    lines.append(f"- 反馈数量：{summary['feedback_count']}")
    lines.append("")

    lines.append("## 概述")
    if seg_type == "noise":
        lines.append("以下为噪声/无效反馈，不进入业务机会排序，保留为低置信度样本，后续人工抽检。")
    elif seg_type == "positive":
        lines.append("以下为正向反馈，不进入问题排序，可进入产品亮点池供产品宣传参考。")
    elif seg_type == "unknown":
        lines.append("以下为未分类反馈，不进入机会排序，进入人工复核队列。")
    lines.append("")
    for c in clusters:
        lines.append(f"- **{c['name']}**：{c['summary']}（{c['feedback_count']} 条反馈）")
    lines.append("")

    if clusters:
        c = clusters[0]
        if c.get("evidence_feedback_ids"):
            lines.append("## 证据反馈")
            lines.append(f"- {', '.join(c['evidence_feedback_ids'])}")
            lines.append("")

    return lines


# ===== Step 3: Render overall MD =====

def render_overall_md(overall, seg_meta, segment_data):
    s = overall["summary"]
    segs = overall["segments"]
    clusters = overall["issue_clusters"]

    non_biz_seg_ids = {"seg-noise", "seg-positive", "seg-unknown"}
    biz_clusters = [c for c in clusters if c["segment_id"] not in non_biz_seg_ids]
    non_biz_clusters = [c for c in clusters if c["segment_id"] in non_biz_seg_ids]

    # 排序函数：priority + evidence_weight
    def prio_sort_key(c):
        prio_order = {"P0": 0, "P1": 1, "P2": 2}
        return (prio_order.get(c.get("priority", "P2"), 3), -c.get("feedback_count", 0))

    # Evidence-weighted sorting: feedback_count >= 5 first, then 2-4, then 1
    def sort_key(c):
        fc = c.get("feedback_count", 0)
        score = dampened_score(c)
        if fc >= 5:
            tier = 2
        elif fc >= 2:
            tier = 1
        else:
            tier = 0
        return (tier, score)

    sorted_biz = sorted(biz_clusters, key=sort_key, reverse=True)

    lines = []
    lines.append("# 混合反馈数据分析报告")
    lines.append("")

    # 分析范围
    non_business = s.get('non_business_segment_count', 0)
    lines.append("## 分析范围")
    lines.append(f"- 总反馈数量：{s['total_feedback_count']}")
    lines.append(f"- 已分析数量：{s['analyzed_feedback_count']}")
    lines.append(f"- 已聚类数量：{s['clustered_feedback_count']}")
    lines.append(f"- 共识别出 {len(clusters)} 个聚类，其中 {len(biz_clusters)} 个为业务问题聚类，{len(non_biz_clusters)} 个为非业务处理类聚类")
    lines.append(f"- 分组数：{s['segment_count']}")
    lines.append(f"- 业务分组数量：{s['business_segment_count']}")
    lines.append(f"- 正向反馈分组数量：{s['positive_segment_count']}")
    lines.append(f"- 噪声分组数量：{s['noise_segment_count']}")
    lines.append(f"- 未分类分组数量：{s.get('unknown_segment_count', 0)}")
    lines.append(f"- 非业务处理类分组数量：{non_business}")
    lines.append("")

    # 数据分组概览
    lines.append("## 数据分组概览")
    lines.append("")
    lines.append("| 分组 | 类型 | 业务目标 | 反馈数 | 聚类数 |")
    lines.append("| --- | --- | --- | --- | --- |")
    for seg in segs:
        seg_id = seg["segment_id"]
        seg_type = "business"
        if seg_id in non_biz_seg_ids:
            seg_type = seg_id.replace("seg-", "")
        goal = seg.get("business_goal", "N/A")
        fc = seg["feedback_count"]
        cc = len(seg.get("issue_cluster_ids", []))
        lines.append(f"| {seg_id} | {seg_type} | {goal} | {fc} | {cc} |")
    lines.append("")

    # 整体核心结论
    lines.append("## 整体核心结论")
    n_top = min(3, len(sorted_biz))
    if len(sorted_biz) <= 3:
        lines.append(f"共分析 {s['total_feedback_count']} 条反馈，识别出 {len(biz_clusters)} 个业务问题聚类，以下按机会分排序展示全部问题。")
    else:
        lines.append(f"共分析 {s['total_feedback_count']} 条反馈，识别出 {len(biz_clusters)} 个业务问题聚类，按机会分排序，Top {n_top} 问题为：")
    lines.append("说明：问题概览按机会分展示；资源投入优先级以 priority + evidence_weight 为准。")
    for i, c in enumerate(sorted_biz[:n_top]):
        fc = c.get("feedback_count", 0)
        ev_tag = "" if fc >= 5 else f"（{fc} 条反馈，需人工复核）" if fc >= 2 else f"（仅 {fc} 条反馈，置信度有限）"
        lines.append(f"{i+1}. **{c['name']}**（{c['segment_id']}，机会分 {dampened_score(c)}）{ev_tag}— {weaken(c['summary'])}")
    lines.append("")

    # 跨分组高优先级问题
    lines.append("## 跨分组高优先级问题")
    p0_biz = [c for c in biz_clusters if c.get("priority") == "P0"]
    if p0_biz:
        p0_sorted = sorted(p0_biz, key=sort_key, reverse=True)
        lines.append("")
        lines.append("| 排名 | 问题名称 | 所属分组 | 机会分 | 反馈数 | 证据权重 |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for i, c in enumerate(p0_sorted):
            fc = c.get("feedback_count", 0)
            ew = "高" if fc >= 5 else "中" if fc >= 2 else "低"
            lines.append(f"| {i+1} | {c['name']} | {c['segment_id']} | {dampened_score(c)} | {fc} | {ew} |")
        lines.append("")

    # 各分组摘要
    lines.append("## 各分组摘要")
    for seg in segs:
        seg_id = seg["segment_id"]
        lines.append(f"### {seg_id}")
        if seg_id in non_biz_seg_ids:
            seg_type = seg_id.replace("seg-", "")
            if seg_type == "noise":
                lines.append(f"- 类型：噪声/无效反馈")
                lines.append(f"- 处理规则：不进入业务机会排序，保留低置信度样本，后续人工抽检")
            elif seg_type == "positive":
                lines.append(f"- 类型：正向反馈")
                lines.append(f"- 处理规则：不进入问题排序，可进入产品亮点池")
            elif seg_type == "unknown":
                lines.append(f"- 类型：未分类")
                lines.append(f"- 处理规则：不进入机会排序，进入人工复核队列")
        else:
            lines.append(f"- 类型：business")
            lines.append(f"- 业务目标：{seg.get('business_goal', 'N/A')}")
        lines.append(f"- 反馈数：{seg['feedback_count']}")
        seg_clusters = [c for c in clusters if c.get("segment_id") == seg_id]
        if seg_clusters:
            for c in seg_clusters:
                fc = c.get("feedback_count", 0)
                ew = "证据充分" if fc >= 5 else "需人工复核" if fc >= 2 else "置信度有限"
                lines.append(f"- {c['name']}（{c['priority']}，机会分 {dampened_score(c)}，{fc} 条，{ew}）")
        lines.append("")

    # 建议行动（按 priority + evidence_weight 排序）
    lines.append("## 建议行动")
    action_sorted = sorted(biz_clusters, key=prio_sort_key)
    for i, c in enumerate(action_sorted[:10]):
        action = "立即修复" if c["priority"] == "P0" else "改善体验" if c["priority"] == "P1" else "加入待办"
        fc = c.get("feedback_count", 0)
        ew = "" if fc >= 5 else " [需人工复核]" if fc >= 2 else " [置信度有限]"
        lines.append(f"{i+1}. [{c['priority']}] **{c['name']}**（{c['segment_id']}）{ew}— {action}")
        if c.get("recommendation"):
            lines.append(f"   - {weaken(c['recommendation'])}")
    lines.append("")

    # 风险提醒
    lines.append("## 风险提醒")
    biz_seg_ids = [s["segment_id"] for s in segs if s["segment_id"] not in non_biz_seg_ids]
    has_p0 = False
    for seg_id in biz_seg_ids:
        seg_p0 = [c for c in biz_clusters if c.get("segment_id") == seg_id and c.get("priority") == "P0"]
        if seg_p0:
            has_p0 = True
            names = ", ".join(c["name"] for c in seg_p0)
            lines.append(f"- **{seg_id}**：有 {len(seg_p0)} 个 P0 问题 — {names}")
    low_ev_all = [c for c in biz_clusters if c.get("feedback_count", 0) < 3]
    if low_ev_all:
        names = ", ".join(c["name"] for c in low_ev_all[:5])
        lines.append(f"- 以下问题反馈数较少（<3），结论置信度有限：{names}")
    if not has_p0 and not low_ev_all:
        lines.append("- 当前无高风险问题，所有业务问题均为 P1/P2 级别。")
    lines.append("")

    # 需要进一步验证
    lines.append("## 需要进一步验证")
    low_ev = [c for c in biz_clusters if c.get("feedback_count", 0) < 3]
    mid_ev = [c for c in biz_clusters if 2 <= c.get("feedback_count", 0) <= 4]
    for c in low_ev:
        metrics = c.get("possible_metrics", [])
        metric_name = metrics[0] if metrics else "用户满意度"
        lines.append(f"- {c['name']}（{c['segment_id']}，{c['feedback_count']} 条反馈）：该问题是否在更多用户中集中出现？对{metric_name}的影响比例有多大？")
    for c in mid_ev:
        if c not in low_ev:
            metrics = c.get("possible_metrics", [])
            metric_name = metrics[0] if metrics else "用户满意度"
            lines.append(f"- {c['name']}（{c['segment_id']}，{c['feedback_count']} 条反馈）：该问题是否在特定场景下集中出现？对{metric_name}的影响有多大？")
    # For segments with sufficient feedback, add business impact questions
    for seg_id in biz_seg_ids:
        seg_clusters = [c for c in biz_clusters if c.get("segment_id") == seg_id]
        sufficient = [c for c in seg_clusters if c.get("feedback_count", 0) >= 5]
        if sufficient and not any(c in low_ev or c in mid_ev for c in seg_clusters):
            top = sorted(sufficient, key=lambda c: dampened_score(c), reverse=True)[0]
            metrics = top.get("possible_metrics", [])
            metric_name = metrics[0] if metrics else "用户满意度"
            lines.append(f"- {seg_id}：{top['name']}对{metric_name}的实际影响比例是多少？是否需要优先投入资源？")
    lines.append("")

    # 给老板看的摘要（按 priority + evidence_weight 排序，不按 opportunity_score）
    boss_sorted = sorted(biz_clusters, key=prio_sort_key)

    lines.append("## 给老板看的摘要")
    lines.append("")
    lines.append("### 核心问题")
    p0_in_boss = [c for c in boss_sorted if c.get("priority") == "P0"]
    for c in p0_in_boss:
        fc = c.get("feedback_count", 0)
        ew = "" if fc >= 5 else f"（{fc} 条反馈）"
        conf_tag = ""
        if c.get("low_confidence"):
            conf_tag = " [低置信度]"
        elif c.get("needs_validation"):
            conf_tag = " [需验证]"
        lines.append(f"- {c['name']}（{c['segment_id']}，{c['priority']}）{ew}{conf_tag}")
    lines.append("")
    lines.append("### 直接后果")
    if p0_in_boss:
        for c in p0_in_boss:
            lines.append(f"- {c['name']}：{weaken(c['summary'])}")
    elif boss_sorted:
        lines.append(f"- {weaken(boss_sorted[0]['summary'])}")
    lines.append("")
    lines.append("### 关键机会")
    for c in boss_sorted[:3]:
        conf_tag = ""
        if c.get("low_confidence"):
            conf_tag = "（需补充数据）"
        elif c.get("needs_validation"):
            conf_tag = "（需验证影响范围）"
        lines.append(f"- {c['name']}{conf_tag}：{weaken(c.get('recommendation', ''))}")
    lines.append("")
    lines.append("### 建议")
    # Count high-evidence P0 (fc >= 5)
    high_ev_p0 = [c for c in p0_biz if c.get("feedback_count", 0) >= 5]
    mid_ev_p1 = [c for c in biz_clusters if c.get("priority") == "P1" and (c.get("low_confidence") or c.get("needs_validation"))]
    if high_ev_p0:
        lines.append(f"- 第一阶段优先处理 {len(high_ev_p0)} 个高证据、高影响问题")
    else:
        lines.append("- 当前无高证据 P0 问题，建议先验证 P1 问题后再决定优先级")
    if mid_ev_p1:
        names = ", ".join(c["name"] for c in mid_ev_p1[:5])
        lines.append(f"- 其余中低证据问题进入专项验证池：{names}")
    if sorted_biz:
        lines.append(f"- 重点关注 {sorted_biz[0]['segment_id']} 分组（机会分最高）")
    lines.append("")

    return lines


# ===== Step 0: Canonicalize segment JSON cluster_ids =====

def canonicalize_segment_jsons(seg_meta):
    """归一化所有 segment JSON 中的 cluster_id，防止重复前缀。"""
    meta_lookup = {s["segment_id"]: s for s in seg_meta["segments"]}
    for fname in sorted(os.listdir(SEG_DIR)):
        if not fname.endswith(".analysis.json"):
            continue
        fpath = os.path.join(SEG_DIR, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        seg_id = data["segment_id"]
        seg_type = data.get("segment_type", meta_lookup.get(seg_id, {}).get("segment_type", "unknown"))
        changed = False
        for c in data.get("issue_clusters", []):
            old_id = c["cluster_id"]
            new_id = canonicalize_cluster_id(old_id, seg_id, seg_type)
            if new_id != old_id:
                c["cluster_id"] = new_id
                changed = True
            # Low-evidence dampening: cap opportunity_score for small samples
            fc = c.get("feedback_count", 0)
            score = c.get("opportunity_score", 0)
            if fc <= 2 and score > 65:
                c["opportunity_score"] = 65
                changed = True
            elif fc == 3 and score > 75:
                c["opportunity_score"] = 75
                changed = True
        if changed:
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"🔧 {fname}: cluster_id 已归一化")


# ===== Main =====

def main():
    with open(SEGMENTS_JSON, "r", encoding="utf-8") as f:
        seg_meta = json.load(f)

    # Step 0: 先归一化 segment JSON 中的 cluster_id
    canonicalize_segment_jsons(seg_meta)

    # Step 1: 从 segment JSON 重建 overall JSON
    overall, seg_meta, segment_data = rebuild_overall_json()

    # Build seg_meta lookup
    meta_lookup = {s["segment_id"]: s for s in seg_meta["segments"]}

    # Render segment MDs
    for seg_id, data in segment_data.items():
        md_path = os.path.join(SEG_DIR, f"{seg_id}.analysis.md")
        seg_type = data.get("segment_type", "unknown")
        if seg_type == "business":
            lines = render_business_segment_md(data, meta_lookup.get(seg_id, {}))
        else:
            lines = render_nonbusiness_segment_md(data)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        print(f"✅ {seg_id}.analysis.md ({len(lines)} lines)")

    # Render overall MD
    lines = render_overall_md(overall, seg_meta, segment_data)
    with open(OVERALL_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"✅ overall.analysis.md ({len(lines)} lines)")

    print("\n✨ 全部重建完成")


if __name__ == "__main__":
    main()
