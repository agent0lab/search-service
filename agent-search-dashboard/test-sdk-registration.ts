/**
 * Standalone test to verify SDK registration flow and outputs
 * 
 * Usage:
 * 1. Fund the test address on Ethereum Sepolia
 * 2. Set TEST_PRIVATE_KEY environment variable
 * 3. Run: npx tsx test-sdk-registration.ts
 * 
 * This test will:
 * - Create an agent
 * - Configure it with various settings
 * - Register it on-chain
 * - Log all outputs at each step
 * - Verify what registerHTTP() returns
 */

import { SDK } from 'agent0-sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { generatePrivateKey } from 'viem';

// Test configuration
const CHAIN_ID = 11155111; // Ethereum Sepolia
const RPC_URL = 'https://rpc.sepolia.org'; // Public RPC

// Get private key from environment or generate a new one
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || generatePrivateKey();

// Get the address from the private key
const account = privateKeyToAccount(TEST_PRIVATE_KEY);
const TEST_ADDRESS = account.address;

console.log('='.repeat(80));
console.log('SDK Registration Flow Test');
console.log('='.repeat(80));
console.log(`Chain ID: ${CHAIN_ID}`);
console.log(`RPC URL: ${RPC_URL}`);
console.log(`Test Address: ${TEST_ADDRESS}`);
console.log(`Private Key: ${TEST_PRIVATE_KEY.startsWith('0x') ? TEST_PRIVATE_KEY.slice(0, 10) + '...' : 'Generated'}`);
console.log('='.repeat(80));
console.log();

async function testSDKRegistration() {
  try {
    // Step 1: Initialize SDK
    console.log('[Step 1] Initializing SDK...');
    const sdk = new SDK({
      chainId: CHAIN_ID,
      rpcUrl: RPC_URL,
      privateKey: TEST_PRIVATE_KEY,
    });
    
    console.log('✓ SDK initialized');
    console.log(`  - isReadOnly: ${sdk.isReadOnly}`);
    console.log(`  - chainId: ${await sdk.chainId()}`);
    console.log(`  - identityRegistryAddress: ${sdk.identityRegistryAddress()}`);
    console.log();

    // Step 2: Create agent
    console.log('[Step 2] Creating agent...');
    const agentName = `Test Agent ${Date.now()}`;
    const agentDescription = 'This is a test agent created by the SDK registration test';
    const agentImage = 'https://example.com/agent.png';
    
    console.log(`  - Name: ${agentName}`);
    console.log(`  - Description: ${agentDescription}`);
    console.log(`  - Image: ${agentImage}`);
    
    const agent = sdk.createAgent(agentName, agentDescription, agentImage);
    
    console.log('✓ Agent object created');
    console.log(`  - agent object type: ${typeof agent}`);
    console.log(`  - has agentId: ${!(agent as any).agentId ? 'NO (expected - not registered yet)' : 'YES'}`);
    console.log(`  - has registrationFile: ${!!(agent as any).registrationFile}`);
    if ((agent as any).registrationFile) {
      console.log(`  - registrationFile keys: ${Object.keys((agent as any).registrationFile).join(', ')}`);
      console.log(`  - registrationFile.agentId: ${(agent as any).registrationFile.agentId || 'undefined (expected)'}`);
    }
    console.log();

    // Step 3: Configure agent
    console.log('[Step 3] Configuring agent...');
    
    // Set MCP endpoint
    agent.setMCP('https://example.com/mcp', '2025-06-18');
    console.log('✓ MCP endpoint set');
    
    // Set A2A endpoint
    agent.setA2A('https://example.com/a2a', '0.30');
    console.log('✓ A2A endpoint set');
    
    // Set trust models
    agent.setTrust(true, false, false); // reputation only
    console.log('✓ Trust models set');
    
    // Set x402 support
    agent.setX402Support(true);
    console.log('✓ x402 support set');
    
    // Set active
    agent.setActive(true);
    console.log('✓ Agent set as active');
    console.log();

    // Step 4: Register on-chain
    console.log('[Step 4] Registering agent on-chain...');
    console.log('  - Calling agent.registerHTTP("")...');
    console.log('  - This should:');
    console.log('    1. Call writeContract() → returns txHash immediately');
    console.log('    2. Call waitForTransaction({ hash: txHash }) → waits for confirmation');
    console.log('    3. Extract agent ID from receipt logs');
    console.log('    4. Set this.registrationFile.agentId');
    console.log('    5. Return this.registrationFile');
    console.log();
    
    const startTime = Date.now();
    let registrationFile;
    let txHash: string | undefined;
    
    try {
      // Try to intercept the transaction hash by monitoring
      // (This is a workaround since we can't intercept inside the SDK)
      console.log('  - Monitoring for transaction...');
      
      registrationFile = await agent.registerHTTP('');
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log(`✓ Registration completed in ${duration} seconds`);
      console.log();
      
      // Step 5: Verify output
      console.log('[Step 5] Verifying registration output...');
      console.log('RegistrationFile returned:', registrationFile);
      console.log();
      console.log('RegistrationFile details:');
      console.log(`  - agentId: ${registrationFile.agentId || 'MISSING!'}`);
      console.log(`  - agentURI: ${registrationFile.agentURI || 'undefined'}`);
      console.log(`  - name: ${registrationFile.name || 'undefined'}`);
      console.log(`  - description: ${registrationFile.description || 'undefined'}`);
      console.log(`  - image: ${registrationFile.image || 'undefined'}`);
      console.log(`  - updatedAt: ${registrationFile.updatedAt || 'undefined'}`);
      console.log();
      
      // Verify agent object state
      console.log('Agent object state after registration:');
      console.log(`  - agent.agentId: ${(agent as any).agentId || 'undefined'}`);
      console.log(`  - agent.agentURI: ${(agent as any).agentURI || 'undefined'}`);
      console.log(`  - agent.registrationFile.agentId: ${(agent as any).registrationFile?.agentId || 'undefined'}`);
      console.log();
      
      // Verify agent ID format
      if (registrationFile.agentId) {
        const parts = registrationFile.agentId.split(':');
        if (parts.length === 2) {
          const [chainId, tokenId] = parts;
          console.log('✓ Agent ID format is correct:');
          console.log(`  - Chain ID: ${chainId}`);
          console.log(`  - Token ID: ${tokenId}`);
          console.log(`  - Full Agent ID: ${registrationFile.agentId}`);
        } else {
          console.log('✗ Agent ID format is incorrect:', registrationFile.agentId);
        }
      } else {
        console.log('✗ ERROR: agentId is missing from RegistrationFile!');
      }
      
      console.log();
      console.log('='.repeat(80));
      console.log('TEST SUMMARY');
      console.log('='.repeat(80));
      
      if (registrationFile.agentId) {
        console.log('✓ SUCCESS: SDK returned RegistrationFile with agentId');
        console.log(`  Agent ID: ${registrationFile.agentId}`);
        console.log(`  Test Address: ${TEST_ADDRESS}`);
        console.log(`  You can view the agent at: https://sepolia.etherscan.io/address/${sdk.identityRegistryAddress()}`);
      } else {
        console.log('✗ FAILURE: SDK did not return agentId in RegistrationFile');
        console.log('  This indicates the SDK is not properly extracting the agent ID from the transaction receipt.');
      }
      
    } catch (err) {
      console.error('✗ Registration failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('  Error message:', errorMessage);
      
      // Try to extract transaction hash from error
      const txHashMatch = errorMessage.match(/0x[a-fA-F0-9]{64}/);
      if (txHashMatch) {
        txHash = txHashMatch[0];
        console.log('  Extracted transaction hash:', txHash);
        console.log(`  View transaction: https://sepolia.etherscan.io/tx/${txHash}`);
      }
      
      throw err;
    }
    
  } catch (err) {
    console.error('='.repeat(80));
    console.error('TEST FAILED');
    console.error('='.repeat(80));
    console.error(err);
    process.exit(1);
  }
}

// Run the test
testSDKRegistration()
  .then(() => {
    console.log();
    console.log('Test completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
