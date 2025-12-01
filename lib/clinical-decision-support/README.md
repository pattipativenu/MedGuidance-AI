# Clinical Decision Support Module

Automatic clinical guidance for psychiatric emergencies, QT-risk medications, and adolescent care.

## Quick Start

```typescript
import { analyzeClinicalContext, needsClinicalDecisionSupport } from '@/lib/clinical-decision-support';

// Check if support is needed
if (needsClinicalDecisionSupport(query)) {
  const support = analyzeClinicalContext(query, medications);
  
  // Inject into AI prompt
  promptContext += support.promptInjection;
  
  // Check flags
  if (support.flags.hasSuicideRisk) {
    console.log(`Risk: ${support.suicideRisk?.riskLevel}`);
    console.log(`Disposition: ${support.suicideRisk?.disposition}`);
  }
}
```

## Modules

### 1. Suicide Risk Assessment
Auto-classifies risk and recommends disposition.

```typescript
import { assessSuicideRisk, isSuicideRiskQuery } from '@/lib/clinical-decision-support';

if (isSuicideRiskQuery(query)) {
  const assessment = assessSuicideRisk(query);
  // assessment.riskLevel: 'high' | 'moderate' | 'low'
  // assessment.disposition: 'inpatient' | 'crisis-stabilization' | 'intensive-outpatient' | 'outpatient'
}
```

**Detects:**
- Active/passive suicidal ideation
- Self-harm behaviors
- Prior attempts
- Psychosis, substance use
- Access to lethal means
- Protective factors

### 2. Safety Plan Template
Stanley-Brown Safety Planning Intervention.

```typescript
import { generateSafetyPlan } from '@/lib/clinical-decision-support';

const plan = generateSafetyPlan({
  isAdolescent: true,
  hasSelfHarm: true,
  hasSubstanceUse: false,
});

// plan.sections: 6 standardized steps
// plan.crisisResources: 988, Crisis Text Line, etc.
// plan.lethalMeansRestriction: Specific guidance
```

**6 Steps:**
1. Warning Signs
2. Internal Coping Strategies
3. Social Distraction
4. Support Network
5. Professional Resources
6. Environment Safety (Lethal Means)

### 3. QT-Risk Library
Database of psychotropic medications with QTc risk profiles.

```typescript
import { assessQTRisk, hasQTRiskMedications } from '@/lib/clinical-decision-support';

const qtMeds = hasQTRiskMedications(query);
if (qtMeds.length > 0) {
  const assessment = assessQTRisk(qtMeds);
  // assessment.totalRisk: 'high' | 'moderate' | 'low'
  // assessment.alternatives: Safer medication options
  // assessment.monitoring: ECG, electrolytes, etc.
}
```

**Risk Categories:**
- **Known:** Hydroxyzine, Citalopram, Haloperidol, Ziprasidone
- **Conditional:** Fluoxetine, Escitalopram, Trazodone, Quetiapine
- **Low:** Sertraline, Buspirone, Melatonin, Aripiprazole, Olanzapine

**Preferred Alternatives:**
- Hydroxyzine → Melatonin (0.5-5mg) or Buspirone (5-10mg BID)
- Citalopram → Sertraline (50-200mg)
- Ziprasidone → Aripiprazole (2-30mg)

### 4. Adolescent Care Templates
Confidentiality, family involvement, school coordination.

```typescript
import { generateAdolescentCareTemplate, isAdolescentPatient } from '@/lib/clinical-decision-support';

if (isAdolescentPatient(query)) {
  const template = generateAdolescentCareTemplate({
    isHighRisk: true,
    hasSchoolIssues: true,
    hasFamilyConflict: false,
  });
  
  // template.confidentiality: What must/may be disclosed
  // template.familyInvolvement: Safety monitoring, roles
  // template.schoolCoordination: 504/IEP, accommodations
  // template.followUpTiming: By risk level
}
```

**Key Components:**
- **Confidentiality:** Interview alone + with family, limits explained
- **Family Roles:** 24/7 monitoring, lethal means restriction, transportation
- **School:** 504 Plan, IEP, accommodations, return-to-school planning
- **Follow-Up:** High risk (24-72h), Moderate (7d), Low (7-14d)

## Integration Example

```typescript
// In API route
import { analyzeClinicalContext, needsClinicalDecisionSupport } from '@/lib/clinical-decision-support';

if (mode === "doctor" && needsClinicalDecisionSupport(message)) {
  console.log("🧠 Analyzing clinical context...");
  
  const clinicalSupport = analyzeClinicalContext(message, drugKeywords);
  
  // Log what was detected
  if (clinicalSupport.flags.hasSuicideRisk) {
    console.log(`   ⚠️ Suicide risk: ${clinicalSupport.suicideRisk?.riskLevel.toUpperCase()}`);
    console.log(`   📋 Disposition: ${clinicalSupport.suicideRisk?.disposition}`);
  }
  
  if (clinicalSupport.flags.hasQTRisk) {
    console.log(`   💊 QT risk: ${clinicalSupport.qtRisk?.totalRisk.toUpperCase()}`);
  }
  
  if (clinicalSupport.flags.isAdolescent) {
    console.log("   👤 Adolescent patient: Including care templates");
  }
  
  // Inject into prompt
  evidenceContext += clinicalSupport.promptInjection;
}
```

## Detection Patterns

### Suicide Risk
- Keywords: `suicid`, `self-harm`, `cutting`, `overdose`, `want to die`, `end my life`
- Behaviors: Recent attempts, giving away possessions, saying goodbye

### QT-Risk Medications
- Antihistamines: hydroxyzine, diphenhydramine
- SSRIs: fluoxetine, citalopram, escitalopram, sertraline
- Antipsychotics: haloperidol, ziprasidone, quetiapine, aripiprazole, olanzapine
- Others: trazodone, mirtazapine, bupropion, buspirone, melatonin

### Adolescent Patients
- Age: 10-20 years old
- Keywords: `adolescent`, `teenager`, `teen`, `high school`, `middle school`

## Response Format

The AI will automatically structure responses with:

1. **📋 Clinical Snapshot** (for complex cases)
   - Risk level + disposition + key action
   - Example: "Risk: HIGH | Disposition: Inpatient | QT: Discontinue hydroxyzine"

2. **Quick Answer** - Primary recommendation

3. **Clinical Answer** - Primary + alternatives with dosing

4. **Evidence Summary** - Why first-line, alternatives

5. **Clinical Recommendations** - Organized by severity
   - Mild-Moderate (Outpatient)
   - Severe/Systemic (Inpatient)
   - Monitoring, Follow-up, Duration

6. **Summary** - Key takeaway

7. **References** - Inline markdown links

## Testing

```bash
npm run test -- lib/clinical-decision-support/__tests__/
```

**Coverage:** 17/17 tests passing
- Suicide risk detection
- Adolescent identification
- QT-risk medication detection
- Risk assessment accuracy
- Alternative suggestions
- Comprehensive analysis

## Guidelines Referenced

- AAP Clinical Report: Management of Pediatric Mental Health Emergencies (2023)
- AACAP Practice Parameter: Assessment and Treatment of Suicidal Behavior
- Stanley-Brown Safety Planning Intervention
- CredibleMeds QT Drug Lists
- FDA Drug Safety Communications
- Joint Commission National Patient Safety Goals

## Files

```
lib/clinical-decision-support/
├── index.ts                          # Main orchestrator
├── suicide-risk-assessment.ts        # Risk tiering engine
├── safety-plan-template.ts           # Stanley-Brown framework
├── qt-risk-library.ts                # QTc risk database
├── adolescent-care-templates.ts      # Confidentiality, family, school
├── __tests__/
│   └── clinical-decision-support.test.ts
└── README.md                         # This file
```

## API Reference

### Main Functions

- `analyzeClinicalContext(query, medications?)` - Comprehensive analysis
- `needsClinicalDecisionSupport(query)` - Quick check if support needed

### Suicide Risk

- `assessSuicideRisk(text)` - Assess risk level
- `isSuicideRiskQuery(query)` - Detect suicide-related queries
- `formatSuicideRiskForPrompt(assessment)` - Format for AI prompt

### Safety Planning

- `generateSafetyPlan(context?)` - Generate Stanley-Brown plan
- `formatSafetyPlanForPrompt(plan)` - Format for AI prompt
- `generateSafetyPlanSummary()` - Brief summary

### QT Risk

- `assessQTRisk(medications)` - Assess QT risk
- `hasQTRiskMedications(query)` - Detect QT-prolonging drugs
- `formatQTRiskForPrompt(assessment)` - Format for AI prompt
- `getSaferAlternatives(drugName)` - Get alternatives for specific drug

### Adolescent Care

- `generateAdolescentCareTemplate(context?)` - Generate care template
- `isAdolescentPatient(query)` - Detect adolescent patients
- `formatAdolescentCareForPrompt(template)` - Format for AI prompt
- `generateAdolescentCareSummary()` - Brief summary

## License

Part of MedGuidance AI - Evidence-based clinical decision support system.
