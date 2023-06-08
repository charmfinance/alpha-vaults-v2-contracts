// returns the sqrt price as a 64x96
import { BigNumber, BigNumberish } from "ethers";
import bn from "bignumber.js";

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

export function encodePriceSqrt(
  reserve1: BigNumberish,
  reserve0: BigNumberish
): BigNumber {
  return BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  );
}

export const getMinTick = (tickSpacing: number) =>
  Math.ceil(-887272 / tickSpacing) * tickSpacing;
export const getMaxTick = (tickSpacing: number) =>
  Math.floor(887272 / tickSpacing) * tickSpacing;
