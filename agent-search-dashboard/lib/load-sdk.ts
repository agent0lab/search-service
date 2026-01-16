'use client';

/**
 * Client-only module for loading the agent0-sdk
 * This module is only imported in client components at runtime
 * 
 * Note: This is a workaround for an SDK issue where the IPFS client
 * has a dynamic import('fs') that Turbopack tries to analyze at build time.
 * The SDK should be fixed to handle browser bundlers better.
 */

export async function loadSDK() {
  // Dynamic import that only happens at runtime
  // The SDK's IPFS client code won't execute in browser, but Turbopack
  // still tries to analyze it. This is an SDK issue.
  const sdkModule = await import('agent0-sdk');
  return sdkModule.SDK;
}
