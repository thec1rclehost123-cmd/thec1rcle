#!/bin/bash

# Vercel Ignored Build Step for Turborepo
# This script conditionally skips the build if the specific app hasn't changed.
# Usage: ./scripts/vercel-ignore-build-step.sh [app_name]

APP_NAME=$1

# If no app name provided, build everything (safe fallback)
if [ -z "$APP_NAME" ]; then
  echo "No app name provided. Proceeding with build."
  exit 1
fi

# Use npx turbo-ignore to check if the build is needed
# Standard exit code: 1 = Proceed with build, 0 = Ignore build
echo "Checking changes for app: $APP_NAME"
npx turbo-ignore $APP_NAME || exit 1

exit 0
