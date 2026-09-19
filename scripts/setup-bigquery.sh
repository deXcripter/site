#!/usr/bin/env bash
#
# One-time BigQuery setup for the AI crawler logging experiment.
#
# Creates a dataset, a partitioned table, and a least-privilege service account,
# then appends the resulting credentials to site/.env.local.
#
# Run from the site/ directory:  bash scripts/setup-bigquery.sh
#
set -euo pipefail

# NOTE: BigQuery's sandbox (billing disabled) permits neither streaming inserts
# nor DML, so the site cannot write rows at all without a billing account
# linked. The free tier (10 GB storage, 1 TB of queries per month) still
# applies once billing is on, so this workload should cost nothing.
# Link one with:
#   gcloud billing accounts list
#   gcloud billing projects link "$PROJECT_ID" --billing-account=<ACCOUNT_ID>

# --- settings -----------------------------------------------------------------
PROJECT_ID="crested-acumen-485020-i2"   # existing empty project being repurposed
DATASET="dexcripter_lab"
TABLE="crawler_hits"
LOCATION="europe-west2"
SA_NAME="crawler-logger"
ACCOUNT="dexcripter@gmail.com"
# ------------------------------------------------------------------------------

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="$(mktemp -t crawler-logger-key-XXXXXX.json)"

echo "==> Using account ${ACCOUNT} and project ${PROJECT_ID}"
gcloud config set account "${ACCOUNT}"
gcloud config set project "${PROJECT_ID}"

echo "==> Renaming project display name to 'dexcripter'"
gcloud projects update "${PROJECT_ID}" --name=dexcripter

echo "==> Checking billing is enabled (writes fail without it)"
if ! gcloud billing projects describe "${PROJECT_ID}" 2>/dev/null | grep -q "billingEnabled: true"; then
  echo "    ERROR: billing is not enabled on ${PROJECT_ID}."
  echo "    BigQuery sandbox blocks both streaming inserts and DML, so no rows can be written."
  echo "    Link a billing account, then re-run this script:"
  echo "      gcloud billing accounts list"
  echo "      gcloud billing projects link ${PROJECT_ID} --billing-account=<ACCOUNT_ID>"
  exit 1
fi

echo "==> Enabling the BigQuery API"
gcloud services enable bigquery.googleapis.com --project="${PROJECT_ID}"

echo "==> Creating dataset ${DATASET} in ${LOCATION}"
bq --location="${LOCATION}" mk --dataset \
  --description "AI crawler rendering experiment for dexcripter.me" \
  "${PROJECT_ID}:${DATASET}" || echo "    (dataset already exists, continuing)"

echo "==> Creating partitioned table ${TABLE}"
bq mk --table \
  --time_partitioning_field ts \
  --time_partitioning_type DAY \
  --description "One row per crawler request. signal=edge is an HTTP request; signal=js-fetch proves JavaScript ran. verify_status says whether the request IP matched the vendor's published crawler ranges." \
  "${PROJECT_ID}:${DATASET}.${TABLE}" \
  ts:TIMESTAMP,request_id:STRING,signal:STRING,host:STRING,path:STRING,method:STRING,user_agent:STRING,bot_name:STRING,bot_vendor:STRING,is_ai_bot:INTEGER,verified:INTEGER,verify_status:STRING,asn:INTEGER,asn_org:STRING,country:STRING,cf_ray:STRING \
  || echo "    (table already exists, continuing)"

# Added after the table already existed on the live deployment, so this runs
# for both fresh and existing installs.
echo "==> Ensuring verify_status column exists"
bq query --use_legacy_sql=false \
  "ALTER TABLE \`${PROJECT_ID}.${DATASET}.${TABLE}\` ADD COLUMN IF NOT EXISTS verify_status STRING" \
  || echo "    (could not alter table, continuing)"

echo "==> Creating service account ${SA_NAME}"
gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="AI crawler logger" \
  --project="${PROJECT_ID}" || echo "    (service account already exists, continuing)"

echo "==> Granting least-privilege roles"
# Write access is scoped to the single dataset, not the whole project.
# `bq add-iam-policy-binding` requires allowlisting on most projects, so the
# dataset's access list is edited directly instead.
DS_JSON="$(mktemp -t dataset-acl-XXXXXX.json)"
bq show --format=prettyjson "${PROJECT_ID}:${DATASET}" > "${DS_JSON}"
python3 - "${DS_JSON}" "${SA_EMAIL}" <<'PY_ACL'
import json, pathlib, sys
path, sa = sys.argv[1], sys.argv[2]
data = json.loads(pathlib.Path(path).read_text())
access = data.get("access", [])
if not any(entry.get("userByEmail") == sa for entry in access):
    access.append({"role": "WRITER", "userByEmail": sa})
    data["access"] = access
    pathlib.Path(path).write_text(json.dumps(data))
    print("    added WRITER for", sa)
else:
    print("    WRITER already present")
PY_ACL
bq update --source "${DS_JSON}" "${PROJECT_ID}:${DATASET}"
rm -f "${DS_JSON}"

# Running any query requires job-creation rights at project level.
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.jobUser" \
  --condition=None \
  --quiet > /dev/null

echo "==> Minting a key"
gcloud iam service-accounts keys create "${KEY_FILE}" \
  --iam-account="${SA_EMAIL}" \
  --project="${PROJECT_ID}"

echo "==> Writing credentials into .env.local"
python3 - "${KEY_FILE}" "${PROJECT_ID}" "${DATASET}" <<'PY'
import json, pathlib, sys

key_path, project_id, dataset = sys.argv[1], sys.argv[2], sys.argv[3]
key = json.loads(pathlib.Path(key_path).read_text())

# The PEM contains real newlines; store them escaped so .env parsing survives.
private_key = key["private_key"].replace("\n", "\\n")

wanted = {
    "GCP_PROJECT_ID": project_id,
    "BQ_DATASET": dataset,
    "GCP_SA_EMAIL": key["client_email"],
    "GCP_SA_PRIVATE_KEY": private_key,
}

env = pathlib.Path(".env.local")
lines = env.read_text().splitlines() if env.exists() else []
kept = [l for l in lines if l.split("=", 1)[0].strip() not in wanted]
kept += [f"{k}={v}" for k, v in wanted.items()]
env.write_text("\n".join(kept).strip() + "\n")
print("    wrote:", ", ".join(wanted))
PY

shred -u "${KEY_FILE}" 2>/dev/null || rm -f "${KEY_FILE}"
echo "==> Key file removed from disk; the only copy now lives in .env.local"
echo
echo "Done. Verify with:  bash scripts/verify-bigquery.sh"
