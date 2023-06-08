import { BigNumber, BigNumberish } from "ethers";
export declare function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): BigNumber;
export declare const getMinTick: (tickSpacing: number) => number;
export declare const getMaxTick: (tickSpacing: number) => number;
