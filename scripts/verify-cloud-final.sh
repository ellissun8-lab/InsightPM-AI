#!/bin/bash
# Load env vars
source /tmp/env-vars.sh 2>/dev/null || true

# Run the verify script
npx tsx scripts/verify-cloud-final.ts
