const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer inside the project root directory.
  // This makes sure the browser is downloaded here and remains persistent/available at runtime.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
