"""
以 JSON 为唯一数据源重新渲染所有 Markdown 文件。
包括 9 个 segment MD 和 1 个 overall MD。
"""
import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "fixtures", "analysis")
SEG_DIR = os.path.join(BASE, "mixed-feedback", "segments")

# ===== 强声明弱化 =====
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

def weaken_claims(text: str) -> str:
    for strong, weak in STRONG_CLAIMS.items():
        text = text.replace(strong, weak)
    return text

# ===== Segment MD 渲染 =====

def render_business_segment_md(data: dict) -> list:
    seg_id = data["segment_id"]
    summary = data["summary"]
    clusters = data["issue_clusters"]

    lines = []
    lines.append(f"# 分组分析报告：{seg_id}")
    lines.append("")

    # 1. 分析范围
    lines.append("## 分析范围")
    lines.append(f"- 分组 ID：{seg_id}")
    lines.append(f"- 分组类型：{data.get('segment_type', 'business')}")
    lines.append(f"- 反馈数量：{summary['feedback_count']}")
    lines.append(f"- 聚类数量：{summary['cluster_count']}")
    lines.append(f"- 已聚类反馈：{summary['clustered_feedback_count']}")
    lines.append(f"- 未聚类反馈：{summary['unclustered_feedback_count']}")
    lines.append("")

    # 2. 核心结论
    lines.append("## 核心结论")
    sorted_clusters = sorted(clusters, key=lambda c: c.get("opportunity_score", 0), reverse=True)
    top3 = sorted_clusters[:3]
    lines.append(f"本分组共识别 {len(clusters)} 个问题，按机会分排序，Top 3 问题为：")
    for i, c in enumerate(top3):
        lines.append(f"{i+1}. **{c['name']}**（机会分 {c.get('opportunity_score', 'N/A')}，{c['priority']}）— {weaken_claims(c['summary'])}")
    lines.append("")

    # 3. 高频问题概览
    lines.append("## 高频问题概览")
    lines.append("")
    lines.append(f"说明：以下为本分组全部 {len(clusters)} 个问题，按机会分降序排列，其余问题见下方问题详情章节。")
    lines.append("")
    lines.append("| 排名 | 问题名称 | 反馈数 | 优先级 | 机会分 |")
    lines.append("| --- | --- | --- | --- | --- |")
    for i, c in enumerate(sorted_clusters):
        lines.append(f"| {i+1} | {c['name']} | {c['feedback_count']} | {c['priority']} | {c.get('opportunity_score', 'N/A')} |")
    lines.append("")

    # 4. 高优先级机会
    lines.append("## 高优先级机会")
    p0_clusters = [c for c in clusters if c.get("priority") == "P0"]
    if p0_clusters:
        for c in p0_clusters:
            lines.append(f"### {c['name']}")
            lines.append(f"- 机会分：{c.get('opportunity_score', 'N/A')}")
            lines.append(f"- 优先级：{c['priority']}")
            lines.append(f"- 摘要：{weaken_claims(c['summary'])}")
            if c.get("possible_metrics"):
                lines.append(f"- 建议指标：{', '.join(c['possible_metrics'])}")
            lines.append("")
    else:
        lines.append("无 P0 级别的问题。")
        lines.append("")

    # 5. 问题详情
    lines.append("## 问题详情")
    for c in sorted_clusters:
        lines.append(f"### {c['name']}")
        lines.append(f"- 优先级：{c['priority']}")
        lines.append(f"- 机会分：{c.get('opportunity_score', 'N/A')}")
        lines.append(f"- 反馈数：{c['feedback_count']}")
        lines.append(f"- 摘要：{weaken_claims(c['summary'])}")
        if c.get("evidence_feedback_ids"):
            lines.append(f"- 证据反馈：{', '.join(c['evidence_feedback_ids'])}")
        if c.get("secondary_themes"):
            lines.append(f"- 次要主题：{', '.join(c['secondary_themes'])}")
        if c.get("possible_metrics"):
            lines.append(f"- 建议指标：{', '.join(c['possible_metrics'])}")
        if c.get("recommendation"):
            lines.append(f"- 建议：{weaken_claims(c['recommendation'])}")
        lines.append("")

    # 6. 建议行动
    lines.append("## 建议行动")
    for i, c in enumerate(sorted_clusters):
        action = "立即修复" if c["priority"] == "P0" else "改善体验" if c["priority"] == "P1" else "加入待办"
        lines.append(f"{i+1}. [{c['priority']}] **{c['name']}** — {action}")
        if c.get("recommendation"):
            lines.append(f"   - {weaken_claims(c['recommendation'])}")
    lines.append("")

    # 7. 风险提醒
    lines.append("## 风险提醒")
    p0_count = len([c for c in clusters if c.get("priority") == "P0"])
    if p0_count > 0:
        lines.append(f"- 本分组有 {p0_count} 个 P0 级问题，需优先处理。")
    low_evidence = [c for c in clusters if c.get("feedback_count", 0) < 3]
    if low_evidence:
        names = ", ".join(c["name"] for c in low_evidence)
        lines.append(f"- 以下问题反馈数较少（<3），结论置信度有限：{names}")
    lines.append("")

    # 8. 需要进一步验证
    lines.append("## 需要进一步验证")
    low_ev = [c for c in clusters if c.get("feedback_count", 0) < 3]
    if low_ev:
        for c in low_ev:
            metrics = c.get("possible_metrics", [])
            metric_name = metrics[0] if metrics else "用户满意度"
            lines.append(f"- {c['name']}（{c['feedback_count']} 条反馈）：该问题是否在更多用户中集中出现？对{metric_name}的影响比例有多大？")
    else:
        lines.append("- 所有问题均有足够反馈支撑，暂无需额外验证")
    lines.append("")

    # 9. 给老板看的摘要
    lines.append("## 给老板看的摘要")
    lines.append("")
    lines.append("### 核心问题")
    for c in sorted_clusters[:3]:
        lines.append(f"- {c['name']}（{c['priority']}，机会分 {c.get('opportunity_score', 'N/A')}）")
    lines.append("")
    lines.append("### 直接后果")
    top1 = sorted_clusters[0]
    lines.append(f"- {weaken_claims(top1['summary'])}")
    lines.append("")
    lines.append("### 关键机会")
    for c in p0_clusters[:2]:
        lines.append(f"- {c['name']}：{weaken_claims(c.get('recommendation', ''))}")
    lines.append("")
    lines.append("### 建议")
    lines.append(f"- 优先投入 {p0_count} 个 P0 问题的修复")
    lines.append(f"- 本分组共 {summary['feedback_count']} 条反馈，覆盖 {len(clusters)} 个问题")
    lines.append("")

    return lines


def render_nonbusiness_segment_md(data: dict) -> list:
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


# ===== Overall MD 渲染 =====

def render_overall_md(overall: dict, segments_data: dict) -> list:
    s = overall["summary"]
    segs = overall["segments"]
    clusters = overall["issue_clusters"]

    lines = []
    lines.append("# 混合反馈数据分析报告")
    lines.append("")

    # 分析范围
    non_biz_seg_ids = {"seg-noise", "seg-positive", "seg-unknown"}
    biz_clusters = [c for c in clusters if c.get("segment_id") not in non_biz_seg_ids]
    non_biz_clusters = [c for c in clusters if c.get("segment_id") in non_biz_seg_ids]
    non_business = s.get('non_business_segment_count', s.get('noise_segment_count', 0) + s.get('positive_segment_count', 0) + s.get('unknown_segment_count', 0))

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
        seg_type = seg.get("segment_type", "unknown")
        goal = seg.get("business_goal", "N/A")
        fc = seg["feedback_count"]
        cc = len(seg.get("issue_cluster_ids", []))
        lines.append(f"| {seg_id} | {seg_type} | {goal} | {fc} | {cc} |")
    lines.append("")

    # 整体核心结论
    lines.append("## 整体核心结论")
    business_segs = [seg for seg in segs if seg.get("segment_type") == "business"]
    business_clusters = [c for c in clusters if c.get("segment_id") in [s["segment_id"] for s in business_segs]]
    sorted_bc = sorted(business_clusters, key=lambda c: c.get("opportunity_score", 0), reverse=True)
    lines.append(f"共分析 {s['total_feedback_count']} 条反馈，识别出 {s['cluster_count']} 个问题聚类，"
                 f"其中业务问题 {len(business_clusters)} 个。按机会分排序，Top 3 问题为：")
    for i, c in enumerate(sorted_bc[:3]):
        lines.append(f"{i+1}. **{c['name']}**（{c['segment_id']}，机会分 {c.get('opportunity_score', 'N/A')}）— {weaken_claims(c['summary'])}")
    lines.append("")

    # 跨分组高优先级问题
    lines.append("## 跨分组高优先级问题")
    p0_clusters = [c for c in business_clusters if c.get("priority") == "P0"]
    if p0_clusters:
        p0_sorted = sorted(p0_clusters, key=lambda c: c.get("opportunity_score", 0), reverse=True)
        lines.append("")
        lines.append("| 排名 | 问题名称 | 所属分组 | 机会分 | 反馈数 |")
        lines.append("| --- | --- | --- | --- | --- |")
        for i, c in enumerate(p0_sorted):
            lines.append(f"| {i+1} | {c['name']} | {c['segment_id']} | {c.get('opportunity_score', 'N/A')} | {c['feedback_count']} |")
        lines.append("")

    # 各分组摘要
    lines.append("## 各分组摘要")
    for seg in segs:
        seg_id = seg["segment_id"]
        lines.append(f"### {seg_id}")
        lines.append(f"- 类型：{seg.get('segment_type', 'unknown')}")
        lines.append(f"- 业务目标：{seg.get('business_goal', 'N/A')}")
        lines.append(f"- 反馈数：{seg['feedback_count']}")
        seg_clusters = [c for c in clusters if c.get("segment_id") == seg_id]
        if seg_clusters:
            for c in seg_clusters:
                lines.append(f"- {c['name']}（{c['priority']}，机会分 {c.get('opportunity_score', 'N/A')}，{c['feedback_count']} 条）")
        lines.append("")

    # 建议行动
    lines.append("## 建议行动")
    for i, c in enumerate(sorted_bc[:10]):
        action = "立即修复" if c["priority"] == "P0" else "改善体验" if c["priority"] == "P1" else "加入待办"
        lines.append(f"{i+1}. [{c['priority']}] **{c['name']}**（{c['segment_id']}）— {action}")
        if c.get("recommendation"):
            lines.append(f"   - {weaken_claims(c['recommendation'])}")
    lines.append("")

    # 风险提醒
    lines.append("## 风险提醒")
    for seg in business_segs:
        seg_id = seg["segment_id"]
        seg_p0 = [c for c in business_clusters if c.get("segment_id") == seg_id and c.get("priority") == "P0"]
        if seg_p0:
            names = ", ".join(c["name"] for c in seg_p0)
            lines.append(f"- **{seg_id}**：有 {len(seg_p0)} 个 P0 问题 — {names}")
    lines.append("")

    # 需要进一步验证
    lines.append("## 需要进一步验证")
    low_evidence = [c for c in business_clusters if c.get("feedback_count", 0) < 3]
    if low_evidence:
        for c in low_evidence:
            metrics = c.get("possible_metrics", [])
            metric_name = metrics[0] if metrics else "用户满意度"
            lines.append(f"- {c['name']}（{c['segment_id']}，{c['feedback_count']} 条反馈）：该问题是否在更多用户中集中出现？对{metric_name}的影响比例有多大？")
    else:
        lines.append("- 所有业务问题均有足够反馈支撑，暂无需额外验证")
    lines.append("")

    # 给老板看的摘要
    lines.append("## 给老板看的摘要")
    lines.append("")
    lines.append("### 核心问题")
    for c in sorted_bc[:5]:
        lines.append(f"- {c['name']}（{c['segment_id']}，{c['priority']}）")
    lines.append("")
    lines.append("### 直接后果")
    if sorted_bc:
        lines.append(f"- {weaken_claims(sorted_bc[0]['summary'])}")
    lines.append("")
    lines.append("### 关键机会")
    for c in sorted_bc[:3]:
        lines.append(f"- {c['name']}：{weaken_claims(c.get('recommendation', ''))}")
    lines.append("")
    lines.append("### 建议")
    lines.append(f"- 全公司优先处理 {len(p0_clusters)} 个 P0 问题")
    lines.append(f"- 重点关注 {sorted_bc[0]['segment_id']} 分组（机会分最高）")
    lines.append("")

    return lines


# ===== 主流程 =====

def main():
    # 渲染 9 个 segment MD
    for fname in os.listdir(SEG_DIR):
        if not fname.endswith(".analysis.json"):
            continue
        json_path = os.path.join(SEG_DIR, fname)
        md_path = json_path.replace(".analysis.json", ".analysis.md")

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        seg_type = data.get("segment_type", "unknown")
        if seg_type == "business":
            lines = render_business_segment_md(data)
        else:
            lines = render_nonbusiness_segment_md(data)

        with open(md_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        print(f"✅ {fname} -> {os.path.basename(md_path)} ({len(lines)} lines)")

    # 渲染 overall MD
    overall_json_path = os.path.join(BASE, "mixed-feedback.overall.analysis.json")
    overall_md_path = os.path.join(BASE, "mixed-feedback.overall.analysis.md")

    with open(overall_json_path, "r", encoding="utf-8") as f:
        overall = json.load(f)

    # 读取 segments.json 获取 segment_type 等信息
    segments_json_path = os.path.join(BASE, "mixed-feedback.segments.json")
    with open(segments_json_path, "r", encoding="utf-8") as f:
        segments_data = json.load(f)

    # 为 overall segments 添加 segment_type
    seg_type_map = {s["segment_id"]: s.get("segment_type", "unknown") for s in segments_data["segments"]}
    for seg in overall["segments"]:
        if "segment_type" not in seg:
            seg["segment_type"] = seg_type_map.get(seg["segment_id"], "unknown")

    lines = render_overall_md(overall, segments_data)
    with open(overall_md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"✅ overall -> {os.path.basename(overall_md_path)} ({len(lines)} lines)")

    print("\n✨ 所有 MD 已从 JSON 重新生成")


if __name__ == "__main__":
    main()
