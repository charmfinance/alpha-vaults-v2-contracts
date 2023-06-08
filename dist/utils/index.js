"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMaxTick = exports.getMinTick = exports.encodePriceSqrt = void 0;
// returns the sqrt price as a 64x96
const ethers_1 = require("ethers");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
bignumber_js_1.default.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });
function encodePriceSqrt(reserve1, reserve0) {
    return ethers_1.BigNumber.from(new bignumber_js_1.default(reserve1.toString())
        .div(reserve0.toString())
        .sqrt()
        .multipliedBy(new bignumber_js_1.default(2).pow(96))
        .integerValue(3)
        .toString());
}
exports.encodePriceSqrt = encodePriceSqrt;
const getMinTick = (tickSpacing) => Math.ceil(-887272 / tickSpacing) * tickSpacing;
exports.getMinTick = getMinTick;
const getMaxTick = (tickSpacing) => Math.floor(887272 / tickSpacing) * tickSpacing;
exports.getMaxTick = getMaxTick;
