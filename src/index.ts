import { JsonRpcBatchProvider } from "@ethersproject/providers";
import {
  approveErc721,
  approveWavax,
  getERC721ApprovalStatus,
  getWavaxApprovalStatus,
  getWavaxBalance,
  handleSignAndExecute,
  handleSignTransaction,
} from "./utils/helpers";
import { ethers } from "ethers";
import axios from "axios";
import {
  API_KEY,
  RPC_URL,
  PRIVATE_KEY,
  CONTRACT_ADDRESS,
  TOKEN_ID,
  PRICE,
} from "./config";

export class MPSDK {
  wallet: ethers.Wallet;
  provider: JsonRpcBatchProvider;
  apiKey: string;

  public constructor(apiKey: string, wallet: ethers.Wallet, rpc: string) {
    this.provider = new JsonRpcBatchProvider(rpc);
    this.wallet = wallet.connect(this.provider);
    this.apiKey = apiKey;
  }

  public async validateSignature(orderObject: any) {
    const data = JSON.stringify({
      order: orderObject,
    });

    // console.log("data====", data);
    const config = {
      method: "post",
      url: "https://avax.api.hyperspace.xyz/rest/validate-signature",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.apiKey,
      },
      data: data,
    };

    return await axios.request(config);
  }

  /**
   * List NFT for sale off chain
   * @param contractAddress
   * @param tokenId
   * @param price
   * @returns boolean for success or failure
   */
  public async listNFT(
    contractAddress: string,
    tokenId: string,
    price: number
  ) {
    console.log("list nft: ", this.wallet.address);
    const seller = this.wallet.address;
    const tokenAddress = `${contractAddress}_${tokenId}`;

    const approved = await getERC721ApprovalStatus(
      this.provider,
      seller,
      contractAddress
    );

    if (!approved) {
      console.log(`Approving marketplace to trade ${contractAddress}`);
      const approveNFTReceipt = await approveErc721(
        this.wallet,
        contractAddress
      );
      console.log(
        `Approve ERC721 Transaction Hash: ${approveNFTReceipt.transactionHash}`
      );
    }

    const data = JSON.stringify({
      condition: {
        list_tx_args: [
          {
            token_address: tokenAddress,
            seller_address: seller as string,
            metadata: {
              contractAddress,
              tokenId,
              price: "" + price,
            },
          },
        ],
      },
    });

    const requestConfig = {
      method: "post",
      url: "https://avax.api.hyperspace.xyz/rest/create-list-tx",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.apiKey,
      },
      data: data,
    };
    const res = await axios.request(requestConfig);

    if (res.data?.length && res.data[0].metadata) {
      const orderData = res.data[0].metadata;

      const { transactionBlockBytes } = await handleSignTransaction(
        orderData,
        this.wallet
      );

      const orderObject = JSON.parse(transactionBlockBytes);

      console.log(
        "=====================================validate===================================="
      );
      // Submit listing to rest endpoint to be indexed and shown in the UI
      const isValidRes = await this.validateSignature(orderObject);
      return isValidRes;
    }
  }
}

let classObj = new MPSDK(API_KEY, new ethers.Wallet(PRIVATE_KEY), RPC_URL);
classObj.listNFT(CONTRACT_ADDRESS, TOKEN_ID, PRICE);
