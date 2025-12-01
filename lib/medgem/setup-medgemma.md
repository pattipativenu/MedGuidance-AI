# MedGemma Vertex AI Setup Guide

## Prerequisites

You've already deployed MedGemma to Vertex AI. Now we need to configure the connection.

## Step 1: Find Your MedGemma Endpoint

1. Go to [Vertex AI Console](https://console.cloud.google.com/vertex-ai/endpoints)
2. Select your project: `mediguidence-ai`
3. Select region: `us-central1`
4. Find your MedGemma endpoint
5. Copy the **Endpoint ID** (it looks like a number, e.g., `1234567890123456789`)

## Step 2: Add Environment Variables

Add these to your `.env.local` file:

```bash
# MedGemma Configuration
MEDGEMMA_ENDPOINT=projects/mediguidence-ai/locations/us-central1/endpoints/YOUR_ENDPOINT_ID

# OR if you just have the endpoint ID:
MEDGEMMA_MODEL_ID=YOUR_ENDPOINT_ID
```

Replace `YOUR_ENDPOINT_ID` with the actual endpoint ID from Step 1.

## Step 3: Verify Authentication

Make sure your Google Cloud credentials are set up:

```bash
# Check if credentials are configured
gcloud auth application-default print-access-token

# If not configured, run:
gcloud auth application-default login
```

Your `.env.local` should already have:
```bash
GOOGLE_CLOUD_PROJECT=mediguidence-ai
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/Users/admin/.config/gcloud/application_default_credentials.json
```

## Step 4: Test the Connection

Create a test file `test-medgemma.ts`:

```typescript
import { testMedGemmaConnection } from './lib/medgem/vertex-ai-connector';

async function test() {
  console.log('Testing MedGemma connection...\n');
  
  const result = await testMedGemmaConnection();
  
  if (result.available) {
    console.log('✅ MedGemma is available!');
    console.log('   Endpoint:', result.endpoint);
  } else {
    console.log('❌ MedGemma is not available');
    console.log('   Error:', result.error);
  }
}

test().catch(console.error);
```

Run it:
```bash
npx tsx test-medgemma.ts
```

## Step 5: Test with a Real Image

Create `test-medgemma-image.ts`:

```typescript
import { analyzeMedicalImage } from './lib/medgem';
import * as fs from 'fs';

async function testImageAnalysis() {
  // Load a test X-ray image
  const imageBuffer = fs.readFileSync('path/to/test-xray.jpg');
  const base64 = imageBuffer.toString('base64');

  console.log('Analyzing medical image with MedGemma...\n');

  const result = await analyzeMedicalImage({
    imageBase64: base64,
    imageType: 'chest-xray',
    patientContext: {
      age: 55,
      symptoms: ['chest pain', 'shortness of breath'],
      history: ['smoker'],
    },
  });

  console.log('Model used:', result.metadata.modelUsed);
  console.log('Processing time:', result.metadata.processingTime, 'ms');
  console.log('Confidence:', (result.metadata.confidence * 100).toFixed(1), '%');
  console.log('\nFindings:', result.findings.length);
  console.log('Critical findings:', result.criticalFindings.length);
  
  result.findings.forEach((finding, i) => {
    console.log(`\n${i + 1}. ${finding.description}`);
    console.log('   Severity:', finding.severity);
    console.log('   Location:', finding.location);
    console.log('   Confidence:', (finding.confidence * 100).toFixed(1), '%');
    console.log('   Bounding box:', finding.boundingBox);
  });
}

testImageAnalysis().catch(console.error);
```

Run it:
```bash
npx tsx test-medgemma-image.ts
```

## Step 6: Verify in Your App

The analyzer will automatically use MedGemma when available. You should see in the logs:

```
🚀 Using Vertex AI MedGemma for analysis...
✅ MedGemma analysis complete
```

If MedGemma fails, it will automatically fall back to Gemini:

```
⚠️ MedGemma failed, falling back to Gemini: [error message]
🔬 Using Gemini 2.5 Flash for analysis...
✅ Gemini analysis complete
```

## Troubleshooting

### Error: "MedGemma endpoint not configured"

**Solution**: Add `MEDGEMMA_ENDPOINT` or `MEDGEMMA_MODEL_ID` to `.env.local`

### Error: "Permission denied accessing MedGemma"

**Solution**: Ensure your service account has the correct permissions:

```bash
# Grant Vertex AI User role
gcloud projects add-iam-policy-binding mediguidence-ai \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@mediguidence-ai.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Or use your user account
gcloud auth application-default login
```

### Error: "Endpoint not found"

**Solution**: Verify the endpoint exists:

```bash
gcloud ai endpoints list \
  --project=mediguidence-ai \
  --region=us-central1
```

### MedGemma is slow

**Solution**: 
- Check your endpoint's machine type (upgrade if needed)
- Consider enabling autoscaling
- Use batch processing for multiple images

### Want to force Gemini instead of MedGemma?

Pass `useVertexAI: false` in config:

```typescript
const result = await analyzeMedicalImage(input, {
  useVertexAI: false, // Force Gemini
});
```

### Want to disable fallback to Gemini?

Pass `fallbackToGemini: false` in config:

```typescript
const result = await analyzeMedicalImage(input, {
  fallbackToGemini: false, // Throw error if MedGemma fails
});
```

## Performance Comparison

| Model | Processing Time | Accuracy | Cost per Image |
|-------|----------------|----------|----------------|
| **MedGemma (Vertex AI)** | 1-3 seconds | Clinical-grade | ~$0.01-0.05 |
| **Gemini 2.5 Flash** | 3-8 seconds | Good | ~$0.001 |

## Next Steps

1. ✅ Configure endpoint
2. ✅ Test connection
3. ✅ Test with real images
4. 📊 Monitor performance in production
5. 🔧 Tune confidence thresholds
6. 📈 Collect feedback from clinicians

## Support

If you encounter issues:
1. Check the [Vertex AI documentation](https://cloud.google.com/vertex-ai/docs)
2. Review [MedGemma model card](https://ai.google.dev/gemma/docs/medgemma)
3. Check logs in Google Cloud Console
4. Open an issue on GitHub
