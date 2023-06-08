"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZERO_ADDR = exports.TWAP_DURATION = exports.MAX_TWAP_DEVIATION = exports.MIN_TICK_MOVE = exports.PERIOD = exports.LIMIT_THRESHOLD = exports.BASE_THRESHOLD = exports.MAX_TOTAL_SUPPLY = exports.PROTOCOL_FEE = exports.FACTORY_ADDRESS = void 0;
// Uniswap v3 factory on Rinkeby and other chains according to https://docs.uniswap.org/protocol/reference/deployments
exports.FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
exports.PROTOCOL_FEE = 50000;
exports.MAX_TOTAL_SUPPLY = "10000000000000000000000000000000"; //1e32
exports.BASE_THRESHOLD = 3600;
exports.LIMIT_THRESHOLD = 1200;
exports.PERIOD = 43200; // 12 hours
exports.MIN_TICK_MOVE = 0;
exports.MAX_TWAP_DEVIATION = 100; // 1%
exports.TWAP_DURATION = 60; // 60 seconds
exports.ZERO_ADDR = '0x0000000000000000000000000000000000000000';
