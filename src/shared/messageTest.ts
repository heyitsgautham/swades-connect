/**
 * Test message passing system
 * Run this in popup console: chrome.runtime.sendMessage({action: 'TEST'}, console.log)
 */

export async function testMessagePassing() {
  console.log('Testing message passing system...');

  try {
    // Test 1: Service worker connection
    console.log('Test 1: Service worker connection');
    const testResponse = await sendMessage({ action: 'TEST' });
    console.log('✓ Service worker responding:', testResponse);

    // Test 2: Get storage data
    console.log('\nTest 2: Get storage data');
    const dataResponse = await sendMessage({ action: 'GET_DATA' });
    console.log('✓ Storage data retrieved:', dataResponse);

    // Test 3: Send save data
    console.log('\nTest 3: Save sample data');
    const saveResponse = await sendMessage({
      action: 'SAVE_DATA',
      data: {
        contacts: [{ id: 'test_1', name: 'Test Contact', email: 'test@example.com', phone: '', company: '', salesperson: '' }],
      },
    });
    console.log('✓ Data saved:', saveResponse);

    console.log('\n✓ All message tests passed!');
  } catch (error) {
    console.error('✗ Message test failed:', error);
  }
}

function sendMessage(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}
