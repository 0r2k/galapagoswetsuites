import crypto from "crypto"
import { getActivePaymentConfig } from './paymentConfig'

async function generateAuthToken() {
  const serverTimeResponse = await fetch("/api/getServerTime")
  const serverTime = await serverTimeResponse.json()

  // Obtener configuración activa desde la base de datos
  const activeConfig = await getActivePaymentConfig()
  
  if (!activeConfig) {
    throw new Error('No hay configuración de pago activa. Por favor, configure Paymentez en el panel de administración.')
  }

  const server_application_code = activeConfig.app_code
  const server_app_key = activeConfig.app_key

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