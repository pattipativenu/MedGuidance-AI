/**
 * MedGemma Integration Test Script
 * 
 * Run with: npx ts-node scripts/test-medgemma.ts
 * Or: npx tsx scripts/test-medgemma.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testMedGemmaIntegration() {
  console.log('🧪 MedGemma Integration Test\n');
  console.log('='.repeat(50));
  
  // 1. Check environment variables
  console.log('\n📋 Environment Configuration:');
  console.log('  GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT || '❌ Not set');
  console.log('  GOOGLE_CLOUD_LOCATION:', process.env.GOOGLE_CLOUD_LOCATION || '❌ Not set');
  console.log('  MEDGEMMA_ENDPOINT:', process.env.MEDGEMMA_ENDPOINT ? '✅ Set' : '❌ Not set');
  console.log('  MEDGEMMA_MODEL_ID:', process.env.MEDGEMMA_MODEL_ID || '❌ Not set');
  console.log('  MEDGEMMA_DEDICATED_ENDPOINT:', process.env.MEDGEMMA_DEDICATED_ENDPOINT ? '✅ Set' : '❌ Not set');
  console.log('  GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅ Set' : '❌ Not set');
  
  // 2. Test imports
  console.log('\n📦 Testing imports...');
  try {
    const { isMedGemmaAvailable, testMedGemmaConnection } = await import('../lib/medgem/vertex-ai-connector');
    console.log('  ✅ vertex-ai-connector imported successfully');
    
    // 3. Check availability
    console.log('\n🔍 Checking MedGemma availability...');
    const available = isMedGemmaAvailable();
    console.log('  MedGemma available:', available ? '✅ Yes' : '❌ No');
    
    // 4. Test connection
    console.log('\n🔌 Testing connection...');
    const connectionResult = await testMedGemmaConnection();
    console.log('  Connection status:', connectionResult.available ? '✅ Connected' : '❌ Disconnected');
    if (connectionResult.endpoint) {
      console.log('  Endpoint:', connectionResult.endpoint);
    }
    if (connectionResult.error) {
      console.log('  Error:', connectionResult.error);
    }
    
    // 5. Test smart router
    console.log('\n🚦 Testing smart router...');
    const { checkMedGemmaStatus } = await import('../lib/smart-model-router');
    const routerStatus = checkMedGemmaStatus();
    console.log('  Router status:', routerStatus.available ? '✅ Ready' : '❌ Not ready');
    console.log('  Reason:', routerStatus.reason);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ MedGemma integration test completed!');
    console.log('\nNext steps:');
    console.log('1. Start the dev server: npm run dev');
    console.log('2. Test the endpoint: curl http://localhost:3000/api/admin/medgemma-test');
    console.log('3. Upload a medical image in Doctor Mode to test analysis');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testMedGemmaIntegration();
