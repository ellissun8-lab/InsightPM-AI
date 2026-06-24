import * as fs from "fs";
import * as path from "path";

const BASE_DIR = path.join(__dirname, "..");
const TRAINING_DIR = path.join(BASE_DIR, "training-data");
const ACCEPTED_DIR = path.join(TRAINING_DIR, "accepted");
const EVAL_DIR = path.join(BASE_DIR, "evaluation-data");
const HELDOUT_DIR = path.join(EVAL_DIR, "heldout");
const MANIFESTS_DIR = path.join(EVAL_DIR, "manifests");

interface DatasetInfo {
  caseName: string;
  status: string;
  rawCount: number;
  normalizedCount: number;
  clusterCount: number;
  hardValidationScore: number;
  semanticScore: number;
  baselineType: string;
  acceptedAt: string;
}

interface DatasetIndex {
  generatedAt: string;
  totalDatasets: number;
  acceptedCount: number;
  rejectedCount: number;
  totalFeedbacks: number;
  datasets: DatasetInfo[];
}

function selectHeldoutDatasets(index: DatasetIndex): DatasetInfo[] {
  const byType = new Map<string, DatasetInfo[]>();

  for (const ds of index.datasets) {
    if (ds.status !== "accepted") continue;
    const existing = byType.get(ds.baselineType) || [];
    existing.push(ds);
    byType.set(ds.baselineType, existing);
  }

  const heldout: DatasetInfo[] = [];

  for (const [baselineType, datasets] of byType) {
    // Sort by version number (v3 > v2 > v1), pick the latest
    const sorted = datasets.sort((a, b) => {
      const vA = parseInt(a.caseName.match(/v(\d+)$/)?.[1] || "0");
      const vB = parseInt(b.caseName.match(/v(\d+)$/)?.[1] || "0");
      return vB - vA;
    });

    // Pick the latest version as heldout
    heldout.push(sorted[0]);
  }

  return heldout;
}

function copyDatasetRecursive(src: string, dest: string) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(src, dest, { recursive: true });
}

function main() {
  console.log("=== Creating Evaluation Split ===\n");

  // Read dataset index
  const indexPath = path.join(TRAINING_DIR, "dataset-index.json");
  const index: DatasetIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  console.log(`Total datasets: ${index.totalDatasets}`);
  console.log(`Accepted datasets: ${index.acceptedCount}\n`);

  // Select heldout datasets
  const heldoutDatasets = selectHeldoutDatasets(index);

  console.log(`Selected ${heldoutDatasets.length} heldout datasets:`);
  for (const ds of heldoutDatasets) {
    console.log(`  - ${ds.caseName} (${ds.baselineType})`);
  }
  console.log();

  // Create directories
  fs.mkdirSync(HELDOUT_DIR, { recursive: true });
  fs.mkdirSync(MANIFESTS_DIR, { recursive: true });

  // Copy heldout datasets
  const heldoutManifest: Record<string, any> = {};

  for (const ds of heldoutDatasets) {
    const srcPath = path.join(ACCEPTED_DIR, ds.caseName);
    const destPath = path.join(HELDOUT_DIR, ds.caseName);

    if (!fs.existsSync(srcPath)) {
      console.error(`ERROR: Dataset not found: ${srcPath}`);
      process.exit(1);
    }

    console.log(`Copying ${ds.caseName} to heldout...`);
    copyDatasetRecursive(srcPath, destPath);

    heldoutManifest[ds.caseName] = {
      caseName: ds.caseName,
      baselineType: ds.baselineType,
      rawCount: ds.rawCount,
      normalizedCount: ds.normalizedCount,
      clusterCount: ds.clusterCount,
      hardValidationScore: ds.hardValidationScore,
      semanticScore: ds.semanticScore,
      movedFrom: "accepted",
      movedAt: new Date().toISOString(),
    };
  }

  // Write heldout manifest
  const manifestPath = path.join(MANIFESTS_DIR, "heldout-manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        totalHeldout: heldoutDatasets.length,
        datasets: heldoutManifest,
      },
      null,
      2
    )
  );
  console.log(`\nWrote heldout manifest: ${manifestPath}`);

  // Remove heldout datasets from training accepted
  for (const ds of heldoutDatasets) {
    const acceptedPath = path.join(ACCEPTED_DIR, ds.caseName);
    if (fs.existsSync(acceptedPath)) {
      fs.rmSync(acceptedPath, { recursive: true, force: true });
      console.log(`Removed ${ds.caseName} from training/accepted`);
    }
  }

  // Update dataset-index.json (remove heldout datasets)
  const updatedDatasets = index.datasets.filter(
    (ds) => !heldoutDatasets.some((h) => h.caseName === ds.caseName)
  );

  const updatedIndex: DatasetIndex = {
    generatedAt: new Date().toISOString(),
    totalDatasets: updatedDatasets.length,
    acceptedCount: updatedDatasets.filter((d) => d.status === "accepted").length,
    rejectedCount: updatedDatasets.filter((d) => d.status === "rejected").length,
    totalFeedbacks: updatedDatasets.reduce((sum, d) => sum + d.normalizedCount, 0),
    datasets: updatedDatasets,
  };

  fs.writeFileSync(indexPath, JSON.stringify(updatedIndex, null, 2));
  console.log(`\nUpdated dataset-index.json: ${updatedIndex.totalDatasets} datasets`);

  // Update validation-summary.csv (remove heldout datasets)
  const csvPath = path.join(TRAINING_DIR, "validation-summary.csv");
  const csvLines = fs.readFileSync(csvPath, "utf-8").split("\n");
  const header = csvLines[0];
  const heldoutNames = new Set(heldoutDatasets.map((d) => d.caseName));
  const filteredLines = [header, ...csvLines.slice(1).filter((line) => {
    const caseName = line.split(",")[0];
    return !heldoutNames.has(caseName);
  })];
  fs.writeFileSync(csvPath, filteredLines.join("\n"));
  console.log(`Updated validation-summary.csv`);

  // Generate evaluation-summary.json
  const evalSummary = {
    createdAt: new Date().toISOString(),
    version: "training-data-v0.1",
    heldoutCount: heldoutDatasets.length,
    trainingCount: updatedIndex.totalDatasets,
    totalFeedbacks: {
      heldout: heldoutDatasets.reduce((sum, d) => sum + d.normalizedCount, 0),
      training: updatedIndex.totalFeedbacks,
    },
    scenarioCoverage: heldoutDatasets.map((ds) => ({
      type: ds.baselineType,
      heldoutDataset: ds.caseName,
      trainingDatasets: updatedDatasets
        .filter((d) => d.baselineType === ds.baselineType)
        .map((d) => d.caseName),
    })),
    metrics: [
      "segment_count_accuracy",
      "cluster_count_accuracy",
      "evidence_trace_accuracy",
      "report_structure_score",
      "priority_quality_score",
      "low_evidence_handling_score",
      "noise_positive_unknown_handling_score",
      "semantic_score",
    ],
  };

  const evalSummaryPath = path.join(EVAL_DIR, "evaluation-summary.json");
  fs.writeFileSync(evalSummaryPath, JSON.stringify(evalSummary, null, 2));
  console.log(`\nWrote evaluation-summary.json: ${evalSummaryPath}`);

  console.log("\n=== Evaluation Split Complete ===");
  console.log(`Heldout datasets: ${heldoutDatasets.length}`);
  console.log(`Training datasets: ${updatedIndex.totalDatasets}`);
  console.log(`Heldout feedbacks: ${evalSummary.totalFeedbacks.heldout}`);
  console.log(`Training feedbacks: ${evalSummary.totalFeedbacks.training}`);
}

main();
