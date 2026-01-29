# SDK Registration Flow Analysis

## Expected Flow:

1. **`agent.registerHTTP(uri)`** is called
   - Returns: `Promise<RegistrationFile>`
   - RegistrationFile should have: `{ agentId: string, agentURI: string, ... }`

2. **Inside `_registerWithUri(uri)`:**
   - Line 955: `writeContract()` → Returns `txHash` immediately (transaction sent, NOT confirmed)
   - Line 963: `waitForTransaction({ hash: txHash })` → Waits for confirmation (THIS HANGS)
   - Line 966: `_extractAgentIdFromReceipt(receipt)` → Extracts agent ID from receipt logs
   - Line 970: `this.registrationFile.agentId = ${chainId}:${agentId}` → Sets agent ID
   - Line 974: `return this.registrationFile` → Returns RegistrationFile with agentId

## Problem:

- `writeContract()` returns txHash immediately (transaction sent via wallet)
- `waitForTransaction()` uses public RPC which is slow/hangs
- Never reaches line 970 where `this.registrationFile.agentId` is set
- So `agent.registrationFile.agentId` is undefined when we check

## Solution:

We need to:
1. Get the transaction hash BEFORE `waitForTransaction()` hangs
2. Use wallet provider or faster method to wait for transaction
3. Extract agent ID from receipt ourselves
4. Set it manually on the agent object

But we can't intercept inside the SDK. Alternative:
- Monitor wallet transactions to get the hash
- Or use wallet provider's RPC to wait for transaction
- Or manually query the transaction receipt
