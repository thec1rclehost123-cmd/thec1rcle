#!/bin/bash

# Prompt for live keys securely
echo "Please enter your LIVE Razorpay Key ID (starts with rzp_live_):"
read -s LIVE_KEY_ID
echo "Please enter your LIVE Razorpay Key Secret:"
read -s LIVE_KEY_SECRET
echo "Please enter your LIVE Webhook Secret (or press enter to skip):"
read -s LIVE_WEBHOOK_SECRET

if [[ -z "$LIVE_KEY_ID" || -z "$LIVE_KEY_SECRET" ]]; then
    echo -e "\nError: Key ID and Secret are required."
    exit 1
fi

echo -e "\nUpdating files..."

OLD_KEY_ID="rzp_test_T5Lv1MFYY59MFA"
OLD_KEY_SECRET="hMBUsP95v3WUmyM8HKWuD6k7"

# Cross-platform sed wrapper (macOS uses -i '')
sedi() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

FILES=(
    ".env"
    ".env.development"
    "apps/mobile-app/.env"
    "apps/mobile-app/.env.development"
    "apps/mobile-app/.env.production"
    "apps/api-gateway/.env.development"
)

for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        sedi "s/${OLD_KEY_ID}/${LIVE_KEY_ID}/g" "$file"
        sedi "s/${OLD_KEY_SECRET}/${LIVE_KEY_SECRET}/g" "$file"
        echo "✅ Updated $file"
    fi
done

if [[ -n "$LIVE_WEBHOOK_SECRET" ]]; then
    for file in "${FILES[@]}"; do
        if [[ -f "$file" ]]; then
            # Replace the known test webhook secrets
            sedi "s/ci-test-key/${LIVE_WEBHOOK_SECRET}/g" "$file"
            sedi "s/c1rcle_local_webhook_secret_123/${LIVE_WEBHOOK_SECRET}/g" "$file"
        fi
    done
    echo "✅ Updated Webhook Secrets"
fi

echo "All keys swapped securely! You can delete this script now if you want."
