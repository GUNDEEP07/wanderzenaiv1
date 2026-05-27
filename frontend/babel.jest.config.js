// Inline babel plugin to replace `import.meta.env.X` with `undefined`
// so that Jest (CommonJS transform) can parse Vite-style source files.
function importMetaEnvPlugin({ types: t }) {
  return {
    visitor: {
      MetaProperty(path) {
        if (
          path.node.meta.name === 'import' &&
          path.node.property.name === 'meta'
        ) {
          path.replaceWith(
            t.objectExpression([
              t.objectProperty(
                t.identifier('env'),
                t.objectExpression([])
              ),
            ])
          );
        }
      },
    },
  };
}

module.exports = {
  presets: [
    ["@babel/preset-env", { "targets": { "node": "current" } }],
    ["@babel/preset-react", { "runtime": "automatic" }]
  ],
  plugins: [importMetaEnvPlugin],
};
