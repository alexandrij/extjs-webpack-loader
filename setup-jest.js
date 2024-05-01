const { matchers } = require('jest-json-schema');
expect.extend(matchers);

global.performance = require('perf_hooks').performance;
