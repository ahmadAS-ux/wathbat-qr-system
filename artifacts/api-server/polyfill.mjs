// Polyfill File global for Node.js < 20
if (!globalThis.File) {
  const { Blob } = await import("node:buffer");
  globalThis.File = class File extends Blob {
    constructor(fileBits, fileName, options = {}) {
      super(fileBits, options);
      this.name = fileName;
      this.lastModified = options.lastModified ?? Date.now();
    }
  };
}
