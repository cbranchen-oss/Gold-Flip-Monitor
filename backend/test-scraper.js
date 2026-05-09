import { getCollectPureBid, clearCache } from './scraper.js';

async function testScraper() {
  try {
    console.log('Testing CollectPure scraper...\n');

    // Test 1: Fresh fetch
    console.log('Test 1: Fresh fetch');
    const result1 = await getCollectPureBid();
    console.log('Result:', result1);
    console.log('');

    // Test 2: Cached fetch (should be instant)
    console.log('Test 2: Cached fetch (should be instant)');
    const result2 = await getCollectPureBid();
    console.log('Result:', result2);
    console.log('');

    // Test 3: Clear cache and fetch again
    console.log('Test 3: Clear cache and fetch again');
    clearCache();
    const result3 = await getCollectPureBid();
    console.log('Result:', result3);
    console.log('');

    console.log('✓ All tests passed!');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

testScraper();
