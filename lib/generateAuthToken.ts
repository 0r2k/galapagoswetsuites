import crypto from "crypto"

async function generateAuthToken() {
  const serverTimeResponse = await fetch("/api/getServerTime")
  const serverTime = await serverTimeResponse.json()

  //credenciales proporcionadas por Paymentez, hay de desarrollo y producción
  // const server_application_code = "CHOKOTRIP-EC-SERVER"
  // const server_app_key = "IeqBabo9kNmKbEsVIm2V6T6enavzim"
  const server_application_code = "TESTECUADORSTG-EC-SERVER"
  const server_app_key = "67vVmLALRrbSaQHiEer40gjb49peos"

  const unix_timestamp = String(serverTime.serverTimestamp);

  const uniq_token_string = server_app_key + unix_timestamp;

  const uniq_token_hash = crypto
    .createHash("sha256")
    .update(uniq_token_string)
    .digest("hex");
  console.log("UNIQ HASH:", uniq_token_hash);

  const auth_token = Buffer.from(
    `${server_application_code};${unix_timestamp};${uniq_token_hash}`
  ).toString('base64');

  return auth_token;
}

export default generateAuthToken;