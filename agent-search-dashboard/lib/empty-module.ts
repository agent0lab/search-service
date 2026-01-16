// Empty module to replace Node.js and React Native modules in browser
// Used for modules that are not available in browser environment

// For Node.js modules (fs, path, etc.)
const emptyModule: Record<string, unknown> = {
  // Stub for fs module
  readFileSync: () => {
    throw new Error('File system operations are not available in browser');
  },
  writeFileSync: () => {
    throw new Error('File system operations are not available in browser');
  },
  existsSync: () => false,
  readdirSync: () => [],
  statSync: () => ({ isFile: () => false, isDirectory: () => false }),
};

// Export as both default and named exports to match Node.js module structure
export default emptyModule;
export const readFileSync = emptyModule.readFileSync;
export const writeFileSync = emptyModule.writeFileSync;
export const existsSync = emptyModule.existsSync;
export const readdirSync = emptyModule.readdirSync;
export const statSync = emptyModule.statSync;

