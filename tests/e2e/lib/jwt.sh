#!/usr/bin/env bash
# Shared JWT generation for E2E tests.
# Generates HS256 dev tokens matching the frontend devAuth.ts pattern.

DEV_SECRET="${DEV_SECRET:-dev-secret-do-not-use-in-production}"

base64url_encode() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# Generate a valid dev JWT. Accepts optional overrides:
#   generate_dev_jwt [sub] [role] [tenant_id] [exp_offset_secs]
generate_dev_jwt() {
  local sub="${1:-00000000-0000-0000-0000-000000000099}"
  local role="${2:-admin}"
  local tid="${3:-${TENANT_ID}}"
  local exp_offset="${4:-3600}"
  local header payload header_b64 payload_b64 signature

  header='{"alg":"HS256","typ":"JWT"}'
  payload="{\"sub\":\"${sub}\",\"tenant_id\":\"${tid}\",\"role\":\"${role}\",\"member_id\":\"\",\"exp\":$(($(date +%s) + exp_offset))}"

  header_b64=$(printf '%s' "$header" | base64url_encode)
  payload_b64=$(printf '%s' "$payload" | base64url_encode)

  signature=$(printf '%s' "${header_b64}.${payload_b64}" \
    | openssl dgst -sha256 -hmac "$DEV_SECRET" -binary \
    | base64url_encode)

  echo "${header_b64}.${payload_b64}.${signature}"
}

# Generate an expired JWT (for negative testing)
generate_expired_jwt() {
  local header payload header_b64 payload_b64 signature
  header='{"alg":"HS256","typ":"JWT"}'
  payload="{\"sub\":\"00000000-0000-0000-0000-000000000099\",\"tenant_id\":\"${TENANT_ID}\",\"role\":\"admin\",\"member_id\":\"\",\"exp\":$(($(date +%s) - 3600))}"

  header_b64=$(printf '%s' "$header" | base64url_encode)
  payload_b64=$(printf '%s' "$payload" | base64url_encode)

  signature=$(printf '%s' "${header_b64}.${payload_b64}" \
    | openssl dgst -sha256 -hmac "$DEV_SECRET" -binary \
    | base64url_encode)

  echo "${header_b64}.${payload_b64}.${signature}"
}
