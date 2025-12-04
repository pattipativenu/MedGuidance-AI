#!/bin/bash

# Update Cloud Run environment variables from .env.local
# This script reads .env.local and updates Cloud Run service

set -e

PROJECT_ID="mediguidence-ai"
SERVICE_NAME="medguidance-ai"
REGION="us-central1"

echo "🔐 Updating Cloud Run environment variables..."
echo ""

# Read environment variables from .env.local
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found"
  exit 1
fi

# Extract key environment variables (excluding local-only ones)
GEMINI_API_KEY=$(grep "^GEMINI_API_KEY=" .env.local | cut -d= -f2)
PERPLEXITY_API_KEY=$(grep "^PERPLEXITY_API_KEY=" .env.local | cut -d= -f2)
NCBI_API_KEY=$(grep "^NCBI_API_KEY=" .env.local | cut -d= -f2)
SERPER_API_KEY=$(grep "^SERPER_API_KEY=" .env.local | cut -d= -f2)

# Check if required keys exist
if [ -z "$GEMINI_API_KEY" ]; then
  echo "❌ Error: GEMINI_API_KEY not found in .env.local"
  exit 1
fi

echo "✅ Found environment variables in .env.local"
echo ""

# Update Cloud Run service with environment variables
echo "📤 Updating Cloud Run service..."
gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --update-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY},PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY},NCBI_API_KEY=${NCBI_API_KEY},SERPER_API_KEY=${SERPER_API_KEY},NEXT_TELEMETRY_DISABLED=1"

echo ""
echo "✅ Environment variables updated successfully!"
echo ""
echo "🌐 Service URL: https://medguidance-ai-473674535154.us-central1.run.app"
echo ""
echo "⚠️  Note: It may take a few seconds for the new revision to be ready"
