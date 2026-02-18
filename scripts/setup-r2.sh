#!/usr/bin/env bash
set -euo pipefail

# ─── Mirage R2 Setup ───────────────────────────────────────────────
# Interactive script to configure Cloudflare R2 storage for Mirage.
# Creates an R2 bucket, guides you through API credential creation,
# tests the credentials, and writes everything to .env.
#
# Requirements: curl
# Usage: bash scripts/setup-r2.sh
# ───────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
BUCKET_NAME="mirage-textures"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_header() {
  echo ""
  echo -e "${CYAN}${BOLD}═══════════════════════════════════════════${NC}"
  echo -e "${CYAN}${BOLD}  Mirage — Cloudflare R2 Setup${NC}"
  echo -e "${CYAN}${BOLD}═══════════════════════════════════════════${NC}"
  echo ""
}

print_step() {
  echo -e "\n${BOLD}[$1/5]${NC} $2\n"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_info() {
  echo -e "${YELLOW}→${NC} $1"
}

# Open a URL in the default browser (cross-platform)
open_url() {
  local url="$1"
  if command -v open &>/dev/null; then
    open "$url" 2>/dev/null || true
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$url" 2>/dev/null || true
  elif command -v wslview &>/dev/null; then
    wslview "$url" 2>/dev/null || true
  fi
}

# Check dependencies
if ! command -v curl &>/dev/null; then
  print_error "curl is required but not installed."
  exit 1
fi

print_header

# ─── Step 1: Cloudflare Account ID ────────────────────────────────

print_step 1 "Cloudflare Account ID"

echo "  Your Account ID is in the Cloudflare dashboard URL:"
echo -e "  ${CYAN}https://dash.cloudflare.com/<account-id>${NC}"
echo ""
echo "  Or find it at: Dashboard → R2 Object Storage → Overview"
echo "  (shown in the right sidebar under 'Account ID')"
echo ""

read -rp "  Account ID: " CF_ACCOUNT_ID

if [[ -z "$CF_ACCOUNT_ID" ]]; then
  print_error "Account ID is required."
  exit 1
fi

# ─── Step 2: Cloudflare API Token ─────────────────────────────────

print_step 2 "Cloudflare API Token (for bucket creation)"

echo "  Create an API token with R2 edit permissions:"
echo -e "  ${CYAN}https://dash.cloudflare.com/profile/api-tokens${NC}"
echo ""
echo "  Quick setup:"
echo "  1. Click 'Create Token'"
echo "  2. Use the 'Edit Cloudflare R2' template (or create custom)"
echo "  3. Scope: Account → your account, Permissions → R2:Edit"
echo "  4. Copy the generated token"
echo ""

print_info "Opening Cloudflare API Tokens page..."
open_url "https://dash.cloudflare.com/profile/api-tokens"
echo ""

read -rp "  API Token: " CF_API_TOKEN

if [[ -z "$CF_API_TOKEN" ]]; then
  print_error "API Token is required."
  exit 1
fi

# Verify the token works
echo ""
print_info "Verifying API token..."

VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" \
  "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $CF_API_TOKEN")

VERIFY_HTTP=$(echo "$VERIFY_RESPONSE" | tail -1)
VERIFY_BODY=$(echo "$VERIFY_RESPONSE" | sed '$d')

if [[ "$VERIFY_HTTP" != "200" ]]; then
  print_error "API token verification failed (HTTP $VERIFY_HTTP)."
  echo "  Response: $VERIFY_BODY"
  exit 1
fi

print_success "API token is valid."

# ─── Step 3: Create R2 Bucket ─────────────────────────────────────

print_step 3 "Creating R2 bucket"

echo ""
read -rp "  Bucket name [$BUCKET_NAME]: " INPUT_BUCKET
BUCKET_NAME="${INPUT_BUCKET:-$BUCKET_NAME}"

print_info "Creating bucket '$BUCKET_NAME'..."

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/r2/buckets" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$BUCKET_NAME\"}")

CREATE_HTTP=$(echo "$CREATE_RESPONSE" | tail -1)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed '$d')

if [[ "$CREATE_HTTP" == "200" ]] || [[ "$CREATE_HTTP" == "201" ]]; then
  print_success "Bucket '$BUCKET_NAME' created."
elif echo "$CREATE_BODY" | grep -q "already exists"; then
  print_success "Bucket '$BUCKET_NAME' already exists — reusing it."
else
  print_error "Failed to create bucket (HTTP $CREATE_HTTP)."
  echo "  Response: $CREATE_BODY"
  exit 1
fi

# ─── Step 4: R2 S3-Compatible API Credentials ─────────────────────

print_step 4 "R2 API Credentials (S3-compatible)"

echo "  Cloudflare requires you to create R2 API tokens in the dashboard."
echo "  This gives you an Access Key ID + Secret that Mirage uses to upload files."
echo ""
echo "  Steps:"
echo "  1. Go to R2 → Overview → 'Manage R2 API Tokens'"
echo "  2. Click 'Create API Token'"
echo "  3. Name: 'Mirage' (or whatever you like)"
echo "  4. Permissions: 'Object Read & Write'"
echo "  5. Scope: Apply to bucket '$BUCKET_NAME'"
echo "  6. Click 'Create API Token'"
echo "  7. Copy the Access Key ID and Secret Access Key"
echo ""

R2_TOKENS_URL="https://dash.cloudflare.com/$CF_ACCOUNT_ID/r2/api-tokens"
print_info "Opening R2 API Tokens page..."
open_url "$R2_TOKENS_URL"
echo -e "  ${CYAN}$R2_TOKENS_URL${NC}"
echo ""

read -rp "  Access Key ID: " S3_ACCESS_KEY_ID
read -rp "  Secret Access Key: " S3_SECRET_ACCESS_KEY

if [[ -z "$S3_ACCESS_KEY_ID" ]] || [[ -z "$S3_SECRET_ACCESS_KEY" ]]; then
  print_error "Both Access Key ID and Secret Access Key are required."
  exit 1
fi

S3_ENDPOINT="https://$CF_ACCOUNT_ID.r2.cloudflarestorage.com"

# ─── Step 5: Test Credentials ─────────────────────────────────────

print_step 5 "Testing R2 credentials"

print_info "Listing objects in '$BUCKET_NAME' via S3 API..."

# Generate AWS Signature V4 for a simple ListObjectsV2 request
# We'll use curl with AWS sigv4 support if available, otherwise skip
if curl --help 2>&1 | grep -q "aws-sigv4"; then
  TEST_RESPONSE=$(curl -s -w "\n%{http_code}" \
    --aws-sigv4 "aws:amz:auto:s3" \
    --user "$S3_ACCESS_KEY_ID:$S3_SECRET_ACCESS_KEY" \
    "$S3_ENDPOINT/$BUCKET_NAME?list-type=2&max-keys=1")

  TEST_HTTP=$(echo "$TEST_RESPONSE" | tail -1)

  if [[ "$TEST_HTTP" == "200" ]]; then
    print_success "R2 credentials verified — bucket is accessible."
  else
    print_error "Credential test failed (HTTP $TEST_HTTP)."
    echo "  The credentials may still work — this test requires curl with AWS SigV4 support."
    echo "  Continuing anyway..."
  fi
else
  echo "  curl doesn't support --aws-sigv4 (older version)."
  echo "  Skipping credential test — credentials will be verified when Mirage starts."
fi

# ─── Write .env ───────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Writing configuration to .env...${NC}"

# If .env exists, remove old S3 vars and append new ones
if [[ -f "$ENV_FILE" ]]; then
  # Remove existing S3/R2 lines
  TEMP_ENV=$(mktemp)
  grep -v -E '^(S3_|# .*R2|# .*S3|# .*storage)' "$ENV_FILE" | sed '/^$/N;/^\n$/d' > "$TEMP_ENV"
  # Ensure trailing newline
  [[ -s "$TEMP_ENV" ]] && echo "" >> "$TEMP_ENV"
  mv "$TEMP_ENV" "$ENV_FILE"
else
  # Create new .env with database default
  echo "DATABASE_URL=./data/mirage.db" > "$ENV_FILE"
  echo "" >> "$ENV_FILE"
fi

cat >> "$ENV_FILE" <<EOF
# Cloudflare R2 Storage
S3_BUCKET=$BUCKET_NAME
S3_REGION=auto
S3_ENDPOINT=$S3_ENDPOINT
S3_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY=$S3_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE=true
EOF

print_success "Configuration written to .env"

# ─── Done ─────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  R2 setup complete!${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════${NC}"
echo ""
echo "  Mirage will now upload textures to your R2 bucket"
echo "  and serve them through a built-in proxy route."
echo ""
echo "  Next steps:"
echo "  1. Restart Mirage: bun run dev"
echo "  2. Upload a texture in any visualizer session"
echo "  3. The image is stored in R2 — no more base64 in config!"
echo ""
echo -e "  ${YELLOW}Optional:${NC} To serve textures directly from R2 (faster):"
echo "  - Enable public access via r2.dev or a custom domain in the dashboard"
echo "  - Add S3_PUBLIC_URL=https://your-bucket.r2.dev to .env"
echo ""
