/**
 * Cost Tracking API
 * 
 * Monitors AI model usage and estimated costs.
 * Use this to stay within budget and optimize spending.
 */

import { NextRequest, NextResponse } from 'next/server';

// In production, use a database (Redis, PostgreSQL, etc.)
// This is a simple in-memory tracker for demonstration
interface CostTracker {
  medgemmaCallsToday: number;
  geminiCallsToday: number;
  geminiVisionCallsToday: number;
  lastReset: string;
  history: Array<{
    date: string;
    medgemma: number;
    gemini: number;
    geminiVision: number;
    totalCost: number;
  }>;
}

// Global tracker (resets on server restart - use DB in production)
let costTracker: CostTracker = {
  medgemmaCallsToday: 0,
  geminiCallsToday: 0,
  geminiVisionCallsToday: 0,
  lastReset: new Date().toDateString(),
  history: [],
};

// Cost constants
const COSTS = {
  MEDGEMMA_PER_CALL: 0.001,
  GEMINI_PER_CALL: 0.00001,
  GEMINI_VISION_PER_CALL: 0.0001,
  MEDGEMMA_ENDPOINT_HOURLY: 0.85,
};

function resetIfNewDay() {
  const today = new Date().toDateString();
  if (costTracker.lastReset !== today) {
    // Save yesterday's data to history
    const yesterdayCost = 
      (costTracker.medgemmaCallsToday * COSTS.MEDGEMMA_PER_CALL) +
      (costTracker.geminiCallsToday * COSTS.GEMINI_PER_CALL) +
      (costTracker.geminiVisionCallsToday * COSTS.GEMINI_VISION_PER_CALL);
    
    costTracker.history.push({
      date: costTracker.lastReset,
      medgemma: costTracker.medgemmaCallsToday,
      gemini: costTracker.geminiCallsToday,
      geminiVision: costTracker.geminiVisionCallsToday,
      totalCost: yesterdayCost,
    });
    
    // Keep only last 30 days
    if (costTracker.history.length > 30) {
      costTracker.history = costTracker.history.slice(-30);
    }
    
    // Reset counters
    costTracker.medgemmaCallsToday = 0;
    costTracker.geminiCallsToday = 0;
    costTracker.geminiVisionCallsToday = 0;
    costTracker.lastReset = today;
  }
}

/**
 * GET /api/admin/costs
 * Returns current cost statistics
 */
export async function GET(request: NextRequest) {
  resetIfNewDay();
  
  // Calculate today's estimated cost
  const todayCost = 
    (costTracker.medgemmaCallsToday * COSTS.MEDGEMMA_PER_CALL) +
    (costTracker.geminiCallsToday * COSTS.GEMINI_PER_CALL) +
    (costTracker.geminiVisionCallsToday * COSTS.GEMINI_VISION_PER_CALL);
  
  // Calculate monthly projection
  const daysInMonth = 30;
  const projectedMonthlyCost = todayCost * daysInMonth;
  
  // Get limits from env
  const medgemmaLimit = parseInt(process.env.MEDGEMMA_DAILY_LIMIT || '0');
  const alertThreshold = parseFloat(process.env.COST_ALERT_THRESHOLD || '50');
  
  // Calculate savings (vs using MedGemma for everything)
  const totalCalls = costTracker.medgemmaCallsToday + 
                     costTracker.geminiCallsToday + 
                     costTracker.geminiVisionCallsToday;
  const allMedGemmaCost = totalCalls * COSTS.MEDGEMMA_PER_CALL;
  const savings = allMedGemmaCost - todayCost;
  
  // Check if approaching limits
  const warnings: string[] = [];
  if (medgemmaLimit > 0 && costTracker.medgemmaCallsToday >= medgemmaLimit * 0.8) {
    warnings.push(`Approaching MedGemma daily limit (${costTracker.medgemmaCallsToday}/${medgemmaLimit})`);
  }
  if (projectedMonthlyCost > alertThreshold) {
    warnings.push(`Projected monthly cost ($${projectedMonthlyCost.toFixed(2)}) exceeds alert threshold ($${alertThreshold})`);
  }
  
  return NextResponse.json({
    today: {
      date: costTracker.lastReset,
      calls: {
        medgemma: costTracker.medgemmaCallsToday,
        gemini: costTracker.geminiCallsToday,
        geminiVision: costTracker.geminiVisionCallsToday,
        total: totalCalls,
      },
      cost: {
        medgemma: `$${(costTracker.medgemmaCallsToday * COSTS.MEDGEMMA_PER_CALL).toFixed(4)}`,
        gemini: `$${(costTracker.geminiCallsToday * COSTS.GEMINI_PER_CALL).toFixed(6)}`,
        geminiVision: `$${(costTracker.geminiVisionCallsToday * COSTS.GEMINI_VISION_PER_CALL).toFixed(5)}`,
        total: `$${todayCost.toFixed(4)}`,
      },
      savings: `$${savings.toFixed(4)}`,
      savingsPercent: totalCalls > 0 ? `${((savings / allMedGemmaCost) * 100).toFixed(1)}%` : '0%',
    },
    limits: {
      medgemmaDaily: medgemmaLimit || 'unlimited',
      medgemmaRemaining: medgemmaLimit > 0 
        ? Math.max(0, medgemmaLimit - costTracker.medgemmaCallsToday)
        : 'unlimited',
      alertThreshold: `$${alertThreshold}`,
    },
    projections: {
      monthly: `$${projectedMonthlyCost.toFixed(2)}`,
      monthlyWithEndpoint: `$${(projectedMonthlyCost + (COSTS.MEDGEMMA_ENDPOINT_HOURLY * 24 * 30)).toFixed(2)}`,
    },
    warnings,
    history: costTracker.history.slice(-7), // Last 7 days
    smartRoutingEnabled: process.env.ENABLE_SMART_ROUTING !== 'false',
  });
}

/**
 * POST /api/admin/costs
 * Record a model call
 */
export async function POST(request: NextRequest) {
  resetIfNewDay();
  
  try {
    const body = await request.json();
    const { model, count = 1 } = body;
    
    switch (model) {
      case 'medgemma':
        costTracker.medgemmaCallsToday += count;
        break;
      case 'gemini':
        costTracker.geminiCallsToday += count;
        break;
      case 'gemini-vision':
        costTracker.geminiVisionCallsToday += count;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid model. Use: medgemma, gemini, or gemini-vision' },
          { status: 400 }
        );
    }
    
    // Check limits
    const medgemmaLimit = parseInt(process.env.MEDGEMMA_DAILY_LIMIT || '0');
    const limitReached = medgemmaLimit > 0 && 
                         model === 'medgemma' && 
                         costTracker.medgemmaCallsToday >= medgemmaLimit;
    
    return NextResponse.json({
      success: true,
      model,
      todayCount: model === 'medgemma' 
        ? costTracker.medgemmaCallsToday 
        : model === 'gemini' 
          ? costTracker.geminiCallsToday 
          : costTracker.geminiVisionCallsToday,
      limitReached,
      warning: limitReached ? 'MedGemma daily limit reached. Subsequent calls will use Gemini fallback.' : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/costs
 * Reset counters (admin only)
 */
export async function DELETE(request: NextRequest) {
  // In production, add authentication here
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;
  
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  costTracker = {
    medgemmaCallsToday: 0,
    geminiCallsToday: 0,
    geminiVisionCallsToday: 0,
    lastReset: new Date().toDateString(),
    history: costTracker.history, // Keep history
  };
  
  return NextResponse.json({
    success: true,
    message: 'Counters reset',
  });
}
