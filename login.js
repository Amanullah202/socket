// login.js
const { IndexerRestExplorerApi } = require("@injectivelabs/sdk-ts");
const { getNetworkEndpoints, Network } = require("@injectivelabs/networks");

// Hardcoded fee receiver address
const FEE_RECEIVER_ADDRESS = "inj1msenpzcdqc602k76ll2f4rxqacj8g5pdaz7flq";
const MIN_LOGIN_INJ_AMOUNT = 0.0013;

// Fetch transaction details based on the transaction hash
async function fetchTransactionDetails(txHash) {
// Function to determine network based on the environment variable
function getNetworkFromEnv() {
  if (process.env.CHAIN_NETWORK === 'mainnet') {
    return Network.Mainnet;
  } else {
    return Network.Testnet;
  }
}

// Define endpoints using the network determined by the function
const network = getNetworkFromEnv();
const endpoints = getNetworkEndpoints(network);

  const indexerRestExplorerApi = new IndexerRestExplorerApi(
    `${endpoints.explorer}/api/explorer/v1`
  );
  console.log(`Fetching transaction details for txHash: ${txHash} on network: ${process.env.CHAIN_NETWORK}`);
  return await indexerRestExplorerApi.fetchTransaction(txHash);
}

// Validate transaction against the login requirements
async function validateLoginTransaction(transactionDetails, senderAddress) {
  console.log("Validating transaction details:");

  if (
    !transactionDetails ||
    transactionDetails.code !== 0 ||
    transactionDetails.errorLog
  ) {
    throw new Error("Transaction is not valid or failed.");
  }

  const txSender = transactionDetails.messages[0].message.from_address;
  const txReceiver = transactionDetails.messages[0].message.to_address;
  const amount =
    parseFloat(transactionDetails.messages[0].message.amount[0].amount) / 1e18;

  // Check sender, receiver, and minimum amount
  if (txSender !== senderAddress) {
    throw new Error("Transaction sender does not match the user's address.");
  }
  if (txReceiver !== FEE_RECEIVER_ADDRESS) {
    throw new Error(
      `Receiver address mismatch: Given transaction receiver address: ${txReceiver}, Expected receiver address: ${FEE_RECEIVER_ADDRESS}`
    );
  }
  if (amount < MIN_LOGIN_INJ_AMOUNT) {
    throw new Error(
      `Transaction amount is less than the required ${MIN_LOGIN_INJ_AMOUNT} INJ.`
    );
  }
}

module.exports = async function login(req) {
  try {
    const { transactionID, userAddress } = req.body;
    console.log(
      `Login attempt for address: ${userAddress} with transaction ID: ${transactionID}`
    );

    // Fetch transaction details using the provided transaction hash
    const transactionDetails = await fetchTransactionDetails(transactionID);

    // Validate the transaction to ensure it meets login criteria
    await validateLoginTransaction(transactionDetails, userAddress);

    // Login successful, return success message
    return { data: { message: "Login successful!" } };
  } catch (error) {
    console.error("Login failed:", error.message);
    return { data: { message: error.message } };
  }
};
