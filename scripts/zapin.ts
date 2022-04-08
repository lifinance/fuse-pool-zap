import { exit } from "process";
import { constants, ethers, utils } from "ethers";
import {
  ERC20__factory,
  GenericSwapFacet__factory,
} from "lifi-contract-typings";
import dotenv from "dotenv";
dotenv.config();

// Constants
const UNISWAP_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ZAPPER_FI_CONTRACT = "0x5Ce9b49B7A1bE9f2c3DC2B2A5BaCEA56fa21FBeE";
const CURVE_TRI_CRYPTO_POOL = "0xd51a44d3fae010294c616388b506acda1bfaae46";
const CURVE_TRI_CRYPTO_TOKEN = "0xc4AD29ba4B3c580e6D59105FFf484999997675Ff";
const USDC_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDT_TOKEN = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const LIFI_FUSE_ZAP = "0xa05eb592998b47f56c1f9c591f0e604925f18edb";
const FUSE_POOL_156 = "0x07cd53380FE9B2a5E64099591b498c73F0EfaA66";
const F_TOKEN = "0x03C2d837e625E0f5CC8f50084b7986863c82102C";
const LIFI_CONTRACT = "0x5A9Fd7c39a6C488E715437D7b1f3C823d5596eD1";

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const lifiFactory = new GenericSwapFacet__factory(wallet);
  const lifi = lifiFactory.attach(LIFI_CONTRACT);

  const usdtAmount = utils.parseUnits("25", 6);

  // Swap USDC for USDC
  let abi = [
    "function getAmountsIn(uint256,address[]) external view returns (uint256[])",
    "function swapTokensForExactTokens(uint256,uint256,address[],address,uint256) external",
  ];
  let iface = new utils.Interface(abi);
  const uniswap = new ethers.Contract(UNISWAP_ADDRESS, abi, wallet);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
  const path = [USDC_TOKEN, USDT_TOKEN];
  const amountIn = (await uniswap.getAmountsIn(usdtAmount, path))[0];
  const uniswapCallData = iface.encodeFunctionData("swapTokensForExactTokens", [
    usdtAmount,
    amountIn,
    path,
    LIFI_CONTRACT,
    deadline,
  ]);

  // Zap into CurveTriCrypto Pool
  abi = [
    "function zapIn(address,address,address,uint256,uint256,address,bytes,address) external payable",
  ];
  iface = new utils.Interface(abi);
  const zapperCalldata = iface.encodeFunctionData("zapIn", [
    USDT_TOKEN,
    constants.AddressZero,
    CURVE_TRI_CRYPTO_POOL,
    usdtAmount,
    utils.parseEther("0.015"), // Estimated tokens out
    constants.AddressZero,
    "0x",
    constants.AddressZero,
  ]);

  abi = ["function zapIn(address,address,uint256) external"];
  iface = new utils.Interface(abi);
  const fuseZapCalldata = iface.encodeFunctionData("zapIn", [
    FUSE_POOL_156,
    CURVE_TRI_CRYPTO_TOKEN,
    utils.parseEther("0.015"), // Estimated
  ]);

  const swapData = [
    // Swap USDC for USDT
    {
      sendingAssetId: USDC_TOKEN,
      approveTo: UNISWAP_ADDRESS,
      receivingAssetId: USDC_TOKEN,
      fromAmount: amountIn,
      callTo: UNISWAP_ADDRESS,
      callData: uniswapCallData,
    },
    // Zap into CurveTriCrypto Pool
    {
      sendingAssetId: USDT_TOKEN,
      approveTo: ZAPPER_FI_CONTRACT,
      receivingAssetId: CURVE_TRI_CRYPTO_TOKEN,
      fromAmount: usdtAmount,
      callTo: ZAPPER_FI_CONTRACT,
      callData: zapperCalldata,
    },
    // Zap into Fuse Pool
    {
      sendingAssetId: CURVE_TRI_CRYPTO_TOKEN,
      approveTo: LIFI_FUSE_ZAP,
      receivingAssetId: F_TOKEN,
      fromAmount: utils.parseEther("0.01560881"),
      callTo: LIFI_FUSE_ZAP,
      callData: fuseZapCalldata,
    },
  ];

  const lifiData = {
    transactionId: utils.randomBytes(32),
    integrator: "LIFI ZAPPER",
    referrer: constants.AddressZero,
    sendingAssetId: USDC_TOKEN,
    receivingAssetId: F_TOKEN,
    receiver: await wallet.getAddress(),
    destinationChainId: 1,
    amount: amountIn,
  };

  let tx;
  const usdc = new ERC20__factory(wallet).attach(USDC_TOKEN);
  const approvalAmount = await usdc.allowance(
    await wallet.getAddress(),
    LIFI_CONTRACT
  );
  if (approvalAmount.lt(amountIn)) {
    tx = await usdc.approve(LIFI_CONTRACT, amountIn);
    await tx.wait();
  }
  console.log("Approved");
  console.log("Sending TX...");
  tx = await lifi.swapTokensGeneric(lifiData, swapData, {
    gasLimit: 1000000,
  });
  const receipt = await tx.wait();
  if (receipt.status) {
    console.log("Transction completed!");
  } else {
    console.log("Transaction Reverted!");
  }
  console.log(`TX: https://etherscan.io/tx/${tx.hash}`);
};

main()
  .then(() => {
    exit(0);
  })
  .catch((err) => {
    console.log(err);
    exit(1);
  });
