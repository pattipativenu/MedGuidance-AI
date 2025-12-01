/**
 * Tests for Clinical Decision Support Module
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeClinicalContext,
  needsClinicalDecisionSupport,
  isSuicideRiskQuery,
  isAdolescentPatient,
  hasQTRiskMedications,
  assessSuicideRisk,
  assessQTRisk,
} from '../index';

describe('Clinical Decision Support', () => {
  describe('needsClinicalDecisionSupport', () => {
    it('should detect suicide risk queries', () => {
      expect(needsClinicalDecisionSupport('patient with suicidal ideation')).toBe(true);
      expect(needsClinicalDecisionSupport('self-harm and cutting')).toBe(true);
      expect(needsClinicalDecisionSupport('safety plan for suicide risk')).toBe(true);
    });

    it('should detect adolescent patients', () => {
      expect(needsClinicalDecisionSupport('15-year-old with depression')).toBe(true);
      expect(needsClinicalDecisionSupport('teenager with anxiety')).toBe(true);
    });

    it('should detect QT-risk medications', () => {
      expect(needsClinicalDecisionSupport('patient on hydroxyzine and fluoxetine')).toBe(true);
      expect(needsClinicalDecisionSupport('taking citalopram')).toBe(true);
    });

    it('should return false for non-psychiatric queries', () => {
      expect(needsClinicalDecisionSupport('diabetes management')).toBe(false);
      expect(needsClinicalDecisionSupport('hypertension treatment')).toBe(false);
    });
  });

  describe('isSuicideRiskQuery', () => {
    it('should identify suicide-related queries', () => {
      expect(isSuicideRiskQuery('suicidal ideation')).toBe(true);
      expect(isSuicideRiskQuery('self-harm')).toBe(true);
      expect(isSuicideRiskQuery('wants to die')).toBe(true);
      expect(isSuicideRiskQuery('overdose attempt')).toBe(true);
    });
  });


  describe('isAdolescentPatient', () => {
    it('should identify adolescent patients by age', () => {
      expect(isAdolescentPatient('15-year-old girl')).toBe(true);
      expect(isAdolescentPatient('17 year old male')).toBe(true);
      expect(isAdolescentPatient('13-year-old')).toBe(true);
    });

    it('should identify adolescent patients by keywords', () => {
      expect(isAdolescentPatient('adolescent with depression')).toBe(true);
      expect(isAdolescentPatient('teenager presenting with anxiety')).toBe(true);
      expect(isAdolescentPatient('high school student')).toBe(true);
    });
  });

  describe('hasQTRiskMedications', () => {
    it('should detect QT-prolonging medications', () => {
      expect(hasQTRiskMedications('hydroxyzine 25mg')).toContain('hydroxyzine');
      expect(hasQTRiskMedications('fluoxetine and citalopram')).toContain('fluoxetine');
      expect(hasQTRiskMedications('ziprasidone')).toContain('ziprasidone');
    });

    it('should return empty for non-QT medications', () => {
      expect(hasQTRiskMedications('metformin')).toHaveLength(0);
      expect(hasQTRiskMedications('lisinopril')).toHaveLength(0);
    });
  });

  describe('assessSuicideRisk', () => {
    it('should assess high risk correctly', () => {
      const query = 'active suicidal ideation with plan, recent self-harm, daily suicidal thoughts';
      const result = assessSuicideRisk(query);
      expect(result.riskLevel).toBe('high');
      expect(result.disposition).toBe('inpatient');
    });

    it('should assess moderate risk correctly', () => {
      const query = 'passive suicidal ideation, major depression, insomnia';
      const result = assessSuicideRisk(query);
      expect(['moderate', 'high']).toContain(result.riskLevel);
    });

    it('should include safety plan requirement', () => {
      const query = 'suicidal ideation without plan';
      const result = assessSuicideRisk(query);
      expect(result.safetyPlanRequired).toBeDefined();
    });
  });

  describe('assessQTRisk', () => {
    it('should assess high QT risk for known QT-prolonging drugs', () => {
      const result = assessQTRisk(['hydroxyzine', 'citalopram']);
      expect(result.totalRisk).toBe('high');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should suggest alternatives for QT-prolonging drugs', () => {
      const result = assessQTRisk(['hydroxyzine']);
      expect(result.alternatives.length).toBeGreaterThan(0);
      expect(result.alternatives[0].alternative).toBeDefined();
    });

    it('should assess low risk for safe medications', () => {
      const result = assessQTRisk(['sertraline', 'buspirone']);
      expect(result.totalRisk).toBe('low');
    });
  });

  describe('analyzeClinicalContext', () => {
    it('should generate comprehensive support for adolescent suicide case', () => {
      const query = '15-year-old girl with suicidal ideation, self-harm, on fluoxetine and hydroxyzine';
      const result = analyzeClinicalContext(query);

      expect(result.flags.hasSuicideRisk).toBe(true);
      expect(result.flags.isAdolescent).toBe(true);
      expect(result.flags.hasQTRisk).toBe(true);
      expect(result.suicideRisk).toBeDefined();
      expect(result.adolescentCare).toBeDefined();
      expect(result.promptInjection.length).toBeGreaterThan(0);
    });

    it('should include safety plan for non-inpatient dispositions', () => {
      const query = 'teenager with passive suicidal ideation, strong family support';
      const result = analyzeClinicalContext(query);

      if (result.suicideRisk?.disposition !== 'inpatient') {
        expect(result.safetyPlan).toBeDefined();
      }
    });
  });
});
