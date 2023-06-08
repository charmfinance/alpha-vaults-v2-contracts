import { constants } from "ethers";

// Uniswap v3 factory on Rinkeby and other chains according to https://docs.uniswap.org/protocol/reference/deployments
export const FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";

export const PROTOCOL_FEE = 30000;
export const MAX_TOTAL_SUPPLY = constants.MaxUint256;

//1e32

export const BASE_THRESHOLD = "3600";
export const LIMIT_THRESHOLD = 1200;
export const PERIOD = 43200; // 12 hours
export const MIN_TICK_MOVE = 0;
export const MAX_TWAP_DEVIATION = 100; // 1%
export const TWAP_DURATION = 60; // 60 seconds

export const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
