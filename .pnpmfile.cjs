/* eslint-env node */

module.exports = {
  hooks: {
    readPackage(pkg) {
      if (
        pkg.name === "rollup-plugin-exclude-dependencies-from-bundle" &&
        pkg.peerDependencies
      ) {
        // vite manages rollup
        delete pkg.peerDependencies.rollup;
      }
      return pkg;
    },
  },
};
