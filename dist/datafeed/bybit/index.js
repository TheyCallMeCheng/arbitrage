"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.BybitDataFeed = exports.BybitClient = void 0;
// Export the core client logic (data request logic)
var client_1 = require("./src/client");
Object.defineProperty(exports, "BybitClient", { enumerable: true, get: function () { return client_1.BybitClient; } });
// Export the async multi-datafeed functionality
var index_1 = require("./src/index");
Object.defineProperty(exports, "BybitDataFeed", { enumerable: true, get: function () { return index_1.BybitDataFeed; } });
// Re-export for convenience
var client_2 = require("./src/client");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return client_2.BybitClient; } });
//# sourceMappingURL=index.js.map