/* eslint-env node */

module.exports = {
  hooks: {
    readPackage(pkg) {
      if (!pkg.peerDependencies) {
        return;
      }
      // vite manages rollup
      switch (pkg.name) {
        case "rollup-plugin-exclude-dependencies-from-bundle":
        case "@rollup/pluginutils":
        case "@rollup/plugin-node-resolve": {
          delete pkg.peerDependencies.rollup;
          break;
        }
        case "@rollup/plugin-babel": {
          delete pkg.peerDependencies.rollup;
          delete pkg.peerDependencies["@babel/core"];
          break;
        }
      }
      return pkg;
    },
  },
};
