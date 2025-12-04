#!/bin/bash

# Deploy MedGuidance AI to Google Cloud Run
# Usage: ./scripts/deploy-cloudrun.sh

set -e

PROJECT_ID="mediguidence-ai"
SERVICE_NAME="medguidance-ai"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo "🚀 Deploying MedGuidance AI to Cloud Run..."
echo ""

# Step 1: Set project
echo "📋 Setting project to ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# Step 2: Build Docker image
echo ""
echo "🐳 Building Docker image..."
docker build -t ${SERVICE_NAME} .

# Step 3: Tag image
echo ""
echo "🏷️  Tagging image..."
docker tag ${SERVICE_NAME} ${IMAGE_NAME}

# Step 4: Configure Docker auth
echo ""
echo "🔐 Configuring Docker authentication..."
gcloud auth configure-docker --quiet

# Step 5: Push to GCR
echo ""
echo "📤 Pushing image to Google Container Registry..."
docker push ${IMAGE_NAME}

# Step 6: Deploy to Cloud Run
echo ""
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "NEXT_TELEMETRY_DISABLED=1"

# Step 7: Get service URL
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment complete!"
echo ""
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "⚠️  IMPORTANT: Set environment variables in Cloud Run Console:"
echo "   1. Go to: https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}"
echo "   2. Click 'Edit & Deploy New Revision'"
echo "   3. Add these secrets:"
echo "      - GEMINI_API_KEY"
echo "      - PERPLEXITY_API_KEY"
echo "      - NCBI_API_KEY"
echo "      - SERPER_API_KEY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
