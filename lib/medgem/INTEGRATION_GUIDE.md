## MedGem Integration Guide

This guide shows how to integrate MedGem advanced medical imaging analysis into your existing MedGuidance AI application.

## Quick Start

### 1. Update the API Route

Modify `app/api/chat/route.ts` to use MedGem for medical image analysis:

```typescript
import { analyzeMedicalImage } from '@/lib/medgem';

// In your POST handler, when files are uploaded:
if (hasImages) {
  // Use MedGem for advanced analysis
  const medgemResults = await Promise.all(
    files.map(async (fileData, index) => {
      const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches || !matches[1].startsWith('image/')) return null;

      return analyzeMedicalImage({
        imageBase64: matches[2],
        mimeType: matches[1],
        imageType: 'chest-xray', // Detect from context or user input
        patientContext: {
          age: extractAge(message),
          symptoms: extractSymptoms(message),
          history: extractHistory(message),
        },
      });
    })
  );

  // Format MedGem results for prompt
  const medgemContext = formatMedGemResults(medgemResults);
  evidenceContext += medgemContext;
}
```

### 2. Update the Doctor Mode Page

Modify `app/doctor/page.tsx` to display MedGem findings:

```typescript
import { MedicalImageAnalysis } from '@/lib/medgem/types';

// Add state for MedGem results
const [medgemResults, setMedgemResults] = useState<MedicalImageAnalysis[]>([]);

// When receiving response from API:
if (response.medgemResults) {
  setMedgemResults(response.medgemResults);
}

// Display MedGem findings:
{medgemResults.map((result, index) => (
  <div key={index} className="medgem-analysis">
    <h3>Image Analysis {index + 1}</h3>
    
    {/* Critical Findings Alert */}
    {result.criticalFindings.length > 0 && (
      <div className="critical-alert">
        <AlertCircle className="w-5 h-5" />
        <span>{result.criticalFindings.length} Critical Finding(s)</span>
      </div>
    )}
    
    {/* Overall Impression */}
    <div className="impression">
      <strong>Overall Impression:</strong>
      <p>{result.overallImpression}</p>
    </div>
    
    {/* Findings List */}
    <div className="findings-list">
      {result.findings.map((finding) => (
        <div key={finding.id} className={`finding finding-${finding.severity}`}>
          <div className="finding-header">
            <span className="finding-label">{finding.boundingBox.label}</span>
            <span className={`severity-badge severity-${finding.severity}`}>
              {finding.severity.toUpperCase()}
            </span>
          </div>
          <p className="finding-description">{finding.description}</p>
          <p className="finding-location">
            <MapPin className="w-4 h-4" />
            {finding.location}
          </p>
          <p className="finding-significance">{finding.clinicalSignificance}</p>
        </div>
      ))}
    </div>
    
    {/* Differential Diagnosis */}
    {result.differentialDiagnosis.length > 0 && (
      <div className="differential">
        <h4>Differential Diagnosis</h4>
        <ol>
          {result.differentialDiagnosis.map((diff, i) => (
            <li key={i}>
              <strong>{diff.condition}</strong> ({diff.likelihood} likelihood)
              <ul>
                {diff.supportingFindings.map((finding, j) => (
                  <li key={j}>{finding}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    )}
    
    {/* Recommendations */}
    <div className="recommendations">
      <h4>Recommendations</h4>
      {result.recommendations.immediateActions && (
        <div className="immediate-actions">
          <strong>Immediate Actions:</strong>
          <ul>
            {result.recommendations.immediateActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </div>
      )}
      {result.recommendations.followUp && (
        <div className="follow-up">
          <strong>Follow-Up:</strong>
          <ul>
            {result.recommendations.followUp.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </div>
))}
```

### 3. Enhanced Visual Annotations

Update the annotated image component to use MedGem findings:

```typescript
import { PathologyFinding } from '@/lib/medgem/types';

interface AnnotatedImageProps {
  imageUrl: string;
  findings: PathologyFinding[];
}

export function AnnotatedImage({ imageUrl, findings }: AnnotatedImageProps) {
  return (
    <div className="relative">
      <img src={imageUrl} alt="Medical image" className="w-full" />
      
      {/* Overlay bounding boxes */}
      {findings.map((finding) => {
        const bb = finding.boundingBox;
        const style = {
          position: 'absolute',
          left: `${(bb.xmin / 1000) * 100}%`,
          top: `${(bb.ymin / 1000) * 100}%`,
          width: `${((bb.xmax - bb.xmin) / 1000) * 100}%`,
          height: `${((bb.ymax - bb.ymin) / 1000) * 100}%`,
          border: `2px solid ${getSeverityColor(finding.severity)}`,
          backgroundColor: `${getSeverityColor(finding.severity)}20`,
        };
        
        return (
          <div key={finding.id} style={style} className="finding-box">
            <div className="finding-label">
              {finding.boundingBox.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#ef4444'; // red
    case 'moderate': return '#f59e0b'; // orange
    case 'mild': return '#eab308'; // yellow
    default: return '#10b981'; // green
  }
}
```

### 4. Add Styling

Add these styles to `app/globals.css`:

```css
/* MedGem Analysis Styles */
.medgem-analysis {
  @apply bg-white rounded-lg shadow-md p-6 mb-6;
}

.critical-alert {
  @apply flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-4;
}

.impression {
  @apply mb-6;
}

.findings-list {
  @apply space-y-4 mb-6;
}

.finding {
  @apply border rounded-lg p-4;
}

.finding-critical {
  @apply border-red-300 bg-red-50;
}

.finding-moderate {
  @apply border-orange-300 bg-orange-50;
}

.finding-mild {
  @apply border-yellow-300 bg-yellow-50;
}

.finding-normal {
  @apply border-green-300 bg-green-50;
}

.finding-header {
  @apply flex items-center justify-between mb-2;
}

.finding-label {
  @apply font-semibold text-lg;
}

.severity-badge {
  @apply px-3 py-1 rounded-full text-xs font-bold;
}

.severity-critical {
  @apply bg-red-600 text-white;
}

.severity-moderate {
  @apply bg-orange-600 text-white;
}

.severity-mild {
  @apply bg-yellow-600 text-white;
}

.severity-normal {
  @apply bg-green-600 text-white;
}

.finding-description {
  @apply text-gray-700 mb-2;
}

.finding-location {
  @apply flex items-center gap-1 text-sm text-gray-600 mb-2;
}

.finding-significance {
  @apply text-sm text-gray-600 italic;
}

.differential {
  @apply mb-6;
}

.differential h4 {
  @apply font-semibold text-lg mb-3;
}

.differential ol {
  @apply list-decimal list-inside space-y-2;
}

.differential ul {
  @apply list-disc list-inside ml-6 text-sm text-gray-600;
}

.recommendations {
  @apply border-t pt-4;
}

.recommendations h4 {
  @apply font-semibold text-lg mb-3;
}

.immediate-actions {
  @apply mb-4;
}

.immediate-actions strong {
  @apply text-red-700;
}

.follow-up strong {
  @apply text-blue-700;
}

.recommendations ul {
  @apply list-disc list-inside ml-4 space-y-1;
}

/* Finding Box Overlay */
.finding-box {
  @apply pointer-events-none;
}

.finding-label {
  @apply absolute -top-6 left-0 bg-white px-2 py-1 rounded text-xs font-semibold shadow-md;
}
```

## Advanced Usage

### Batch Analysis

Analyze multiple images at once:

```typescript
import { analyzeMedicalImageBatch } from '@/lib/medgem';

const results = await analyzeMedicalImageBatch({
  images: [
    {
      imageBase64: xray1Base64,
      imageType: 'chest-xray',
      patientContext: { age: 45, symptoms: ['chest pain'] },
    },
    {
      imageBase64: xray2Base64,
      imageType: 'chest-xray',
      patientContext: { age: 45, symptoms: ['chest pain'] },
    },
  ],
  compareAcrossImages: true, // Enable temporal comparison
});

// Access comparison analysis
if (results.comparisonAnalysis) {
  console.log('Changes:', results.comparisonAnalysis.changes);
  console.log('Progression:', results.comparisonAnalysis.progression);
}
```

### Custom Configuration

Configure analysis parameters:

```typescript
const result = await analyzeMedicalImage(
  {
    imageBase64: base64Data,
    imageType: 'ct-chest',
  },
  {
    confidenceThreshold: 0.7, // Only report findings with ≥70% confidence
    maxFindings: 10, // Limit to top 10 findings
    prioritizeCritical: true, // Show critical findings first
    includeRecommendations: true, // Include clinical recommendations
  }
);
```

### Extract Specific Information

```typescript
// Get only critical findings
const criticalFindings = result.criticalFindings;

// Get findings by severity
const moderateFindings = result.findings.filter(f => f.severity === 'moderate');

// Get findings by type
const fractures = result.findings.filter(f => f.type === 'fracture');

// Get findings by location
const rightLungFindings = result.findings.filter(f => 
  f.location.toLowerCase().includes('right')
);
```

## Testing

Create a test file `lib/medgem/test.ts`:

```typescript
import { analyzeMedicalImage } from './analyzer';
import * as fs from 'fs';

async function testMedGem() {
  // Load test image
  const imageBuffer = fs.readFileSync('path/to/test-xray.jpg');
  const base64 = imageBuffer.toString('base64');

  // Analyze
  const result = await analyzeMedicalImage({
    imageBase64: base64,
    imageType: 'chest-xray',
    patientContext: {
      age: 55,
      symptoms: ['shortness of breath', 'chest pain'],
      history: ['smoker', 'hypertension'],
    },
  });

  // Print results
  console.log('Overall Impression:', result.overallImpression);
  console.log('Findings:', result.findings.length);
  console.log('Critical Findings:', result.criticalFindings.length);
  
  result.findings.forEach((finding, i) => {
    console.log(`\nFinding ${i + 1}:`);
    console.log('  Type:', finding.type);
    console.log('  Severity:', finding.severity);
    console.log('  Location:', finding.location);
    console.log('  Description:', finding.description);
    console.log('  Coordinates:', finding.boundingBox);
  });
}

testMedGem().catch(console.error);
```

Run with:
```bash
npx tsx lib/medgem/test.ts
```

## Performance Optimization

### Caching

Implement caching for repeated analyses:

```typescript
const cache = new Map<string, MedicalImageAnalysis>();

async function analyzeMedicalImageCached(input: MedicalImageInput) {
  const cacheKey = hashImage(input.imageBase64);
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }
  
  const result = await analyzeMedicalImage(input);
  cache.set(cacheKey, result);
  
  return result;
}
```

### Parallel Processing

Process multiple images in parallel:

```typescript
const results = await Promise.all(
  images.map(image => analyzeMedicalImage(image))
);
```

## Troubleshooting

### Issue: No findings detected

**Solution**: Check that the image is clear and properly formatted. Try adjusting the `confidenceThreshold` in config.

### Issue: Incorrect bounding boxes

**Solution**: The AI may need more context. Provide patient symptoms and clinical question in `patientContext`.

### Issue: Slow processing

**Solution**: Use batch processing for multiple images. Consider implementing caching.

## Next Steps

1. **Integrate with PACS**: Connect to hospital PACS systems for automatic image retrieval
2. **DICOM Support**: Add support for DICOM format medical images
3. **Report Generation**: Auto-generate structured radiology reports
4. **Vertex AI Migration**: When MedGem access is granted, migrate to direct Vertex AI integration

## Support

For issues or questions:
- Check the [README](./README.md)
- Review [example code](./examples/)
- Open an issue on GitHub
