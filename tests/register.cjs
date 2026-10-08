/* eslint-disable @typescript-eslint/no-require-imports */
// Compile source in memory so the regression suite uses the actual TS modules.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) {
  if (name.startsWith('@/')) name = path.join(root, name.slice(2));
  if (name === 'server-only') return __filename;
  return originalResolve.call(this, name, parent, ...rest);
};
require.extensions['.ts'] = (module, file) => {
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  module._compile(result.outputText, file);
};
module.exports = {};
