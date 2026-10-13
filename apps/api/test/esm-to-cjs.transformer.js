// Jest on Node < 24.9 cannot require() ESM-only packages (@nestjs/config v5+, @nestjs/jwt v12, ...).
const ts = require('typescript');
const crypto = require('node:crypto');

module.exports = {
  getCacheKey(source, filename) {
    return crypto
      .createHash('sha1')
      .update('esm-to-cjs-v2\0')
      .update(filename)
      .update('\0')
      .update(source)
      .digest('hex');
  },
  process(source, filename) {
    const patched = source
      .replace(/^\s*const require = createRequire\(import\.meta\.url\);?\s*$/m, '')
      .replace(
        /\bimport\.meta\.url\b/g,
        "require('node:url').pathToFileURL(__filename).href",
      );
    const { outputText } = ts.transpileModule(patched, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        allowJs: true,
        esModuleInterop: true,
      },
    });
    return { code: outputText };
  },
};
