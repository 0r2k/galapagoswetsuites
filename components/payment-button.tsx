'use client'
import { useEffect, useRef } from "react"
import generateAuthToken from "@/lib/generateAuthToken"
import { Button } from "./ui/button";

const PaymentButton = ({
  email,
  telefono,
  id,
  nombreCompleto,
  taxable,
  taxes,
  total,
  callbackOrden,
  handleResponse,
  disabled
}: any) => {

  const paymentCheckoutRef = useRef<any>(null);

  // El siguiente use Effect permite configurar las funciones de apertura
  // y cierre del modal de Paymentez

  useEffect(() => {

    // La siguiente función permite configurar acciones con la apertura, cierre y respuesta del modal
    const initializePaymentModal = async () => {
      //@ts-ignore
      paymentCheckoutRef.current = new window.PaymentCheckout.modal({
        locale: 'es',
        env_mode: "prod",
        onOpen: function () {
          console.log("modal open");
        },
        onClose: function () {
          console.log("modal closed");
        },
        onResponse: function (response: any) {
          // función del componente padre para cambiar estado
          handleResponse(response.transaction);   
          // función que guarda la orden en una base de datos       
          callbackOrden(response); 
        },
      });

      window.addEventListener("popstate", function () {
        paymentCheckoutRef.current?.close();
      });
    };

    initializePaymentModal();

  }, []);

  // La siguiente función genera la referencia, por eso se ejecuta
  // generateAuthToken()
  const initiateTransaction = async () => {
    const apiUrl =
      "https://ccapi.paymentez.com/v2/transaction/init_reference/";

    // Ejemplo donde en Ecuador se paga el 12% de IVA
    // solo deben tener 2 decimales

    const amount = total.toFixed(2);
    const taxable_amount = taxable.toFixed(2);
    const vat = taxes.toFixed(2);

    //se genera el token
    const authToken = await generateAuthToken();

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Auth-Token": authToken,
      },
      body: JSON.stringify({
        locale: "es",
        order: {
          amount: amount,
          description: "Pago inicial alquiler buceo",
          vat: vat,
          taxable_amount: taxable_amount,
          tax_percentage: 0,
          dev_reference: Math.floor(Math.random() * (150000 - 10000 + 1)) + 10000
        },
        user: {
          id: id, //Cualquier id que se ponga, puede ser alfanumérico
          email: email,
          phone: telefono,
        },
        conf: {
          style_version: "2",
        },
      }),
    };

    try {
      const response = await fetch(apiUrl, requestOptions)
        .then((res) => res.json())
        .then((data) => {
          return data.reference;
        });

      return response;
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Con el llamado y obtención de la referencia se ejecuta la función open
  // del paymentCheckout pasándola como parámetro en un objeto
  const handleButtonClick = async () => {
    const reference = await initiateTransaction();
    paymentCheckoutRef.current?.open({
      reference: reference,
    });
  };

  return (
    <div>
      <Button
        className="mt-6 h-14 font-bold w-full"
        type="button"
        onClick={handleButtonClick}
        disabled={disabled}
      >
        Pagar con tarjeta de crédito/débito
      </Button>
    </div>
  );
};

export default PaymentButton;