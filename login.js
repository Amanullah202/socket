// login.js
const { IndexerRestExplorerApi } = require("@injectivelabs/sdk-ts");
const { getNetworkEndpoints, Network } = require("@injectivelabs/networks");

// Hardcoded fee receiver address
const FEE_RECEIVER_ADDRESS = "inj1pwrmap79xlfkfdqsqlp9m8kkxnczhdxfcwzqk6"; // Replace with the actual receiver address
const MIN_LOGIN_INJ_AMOUNT = 0.00019;

// Fetch transaction details based on the transaction hash
async function fetchTransactionDetails(txHash) {
  const endpoints = getNetworkEndpoints(Network.Testnet);
  const indexerRestExplorerApi = new IndexerRestExplorerApi(
    `${endpoints.explorer}/api/explorer/v1`
  );
  console.log(`Fetching transaction details for txHash: ${txHash}`);
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
    throw new Error("Receiver address does not match the expected address.");
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
