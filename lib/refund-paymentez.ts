import generateAuthToken from "@/lib/generateAuthToken"
import { getActivePaymentConfig } from "@/lib/paymentConfig"

export default async function refundPaymentez(id: any) {
    // Obtener la configuración activa para determinar la URL base
    const paymentConfig = await getActivePaymentConfig();
    
    if (!paymentConfig) {
        throw new Error('No hay configuración de pago activa');
    }
    
    const apiUrl = `${paymentConfig.api_url}/v2/transaction/refund/`;

    const authToken = await generateAuthToken();

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Auth-Token": authToken,
      },
      body: JSON.stringify({
        transaction: {
          id: id,
        },
      }),
    };

    try {
      const response = await fetch(apiUrl, requestOptions)
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          if (data.status === "success") {
            console.log("Reverso ejecutado exitosamente");
          } else {
            console.log("Reverso no se pudo ejecutar");
          }
          return data;
        });

      return response;
    } catch (error) {
      console.error("Error:", error);
    }
  }