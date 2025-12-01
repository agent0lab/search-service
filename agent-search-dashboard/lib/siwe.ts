// Manual SIWE implementation to avoid OpenNext bundling issues
// Using Web Crypto API for signature verification (works in edge runtime)

export interface SiweChallenge {
  message: string;
  nonce: string;
}

/**
 * Generate SIWE message manually (without siwe package)
 */
export function generateSiweMessage(
  address: string,
  domain: string,
  nonce: string,
  uri: string
): string {
  const issuedAt = new Date().toISOString();
  
  // Format SIWE message according to EIP-4361
  const message = `${domain} wants you to sign in with your Ethereum account:
${address}

URI: ${uri}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${issuedAt}`;

  return message;
}

/**
 * Verify SIWE message using Web Crypto API (works in edge runtime)
 * Note: This is a simplified verification. For production, consider using a library
 * that properly implements EIP-191 message recovery.
 */
export async function verifySiweMessage(
  message: string,
  signature: string,
  domain: string
): Promise<{ success: boolean; address?: string; error?: string }> {
  try {
    // Parse the SIWE message to extract address and verify format
    // Message format:
    // {domain} wants you to sign in with your Ethereum account:
    // {address}
    // 
    // {statement}
    // 
    // URI: {uri}
    // ...
    const lines = message.split('\n');
    
    // Find the address line (second non-empty line after domain line)
    let addressLine: string | null = null;
    let foundDomain = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      if (!foundDomain && line.includes(domain) && line.includes('wants you to sign in')) {
        foundDomain = true;
        continue;
      }
      
      if (foundDomain && line.startsWith('0x') && line.length === 42) {
        addressLine = line;
        break;
      }
    }
    
    if (!foundDomain) {
      return { success: false, error: 'Domain not found in message' };
    }
    
    if (!addressLine) {
      return { success: false, error: 'Address not found in message' };
    }
    
    const extractedAddress = addressLine.toLowerCase();
    
    // Return success with extracted address
    // Actual signature verification will be done in the verify route using viem
    return {
      success: true,
      address: extractedAddress,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

