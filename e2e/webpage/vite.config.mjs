/* eslint-env node */

import path from "path";
import { defineConfig } from "vite";
import baseConfig from "../../vite.config.mjs";

export default defineConfig((...args) => {
  const config = baseConfig(...args);
  config.root = path.join(__dirname);
  config.envDir = path.join(__dirname, "..", "..");
  return config;
});
