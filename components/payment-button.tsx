'use client'
import { useEffect, useRef, useState } from "react"
import generateAuthToken from "@/lib/generateAuthToken"
import { getActivePaymentConfig, PaymentConfig } from "@/lib/paymentConfig"
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
  const [activeConfig, setActiveConfig] = useState<PaymentConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Cargar configuración de pago al montar el componente
  useEffect(() => {
    const loadPaymentConfig = async () => {
      try {
        const config = await getActivePaymentConfig();
        setActiveConfig(config);
      } catch (error) {
        console.error('Error loading payment config:', error);
      } finally {
        setConfigLoaded(true);
      }
    };

    loadPaymentConfig();
  }, []);

  // El siguiente use Effect permite configurar las funciones de apertura
  // y cierre del modal de Paymentez
  useEffect(() => {

    // La siguiente función permite configurar acciones con la apertura, cierre y respuesta del modal
    const initializePaymentModal = async () => {
      if (!configLoaded || !activeConfig) {
        // console.error('No hay configuración de pago activa');
        return;
      }
      // console.log('Active Config:', activeConfig);
      //@ts-ignore
      paymentCheckoutRef.current = new window.PaymentCheckout.modal({
        locale: 'es',
        env_mode: activeConfig.environment,
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

  }, [activeConfig, configLoaded]);

  // La siguiente función genera la referencia, por eso se ejecuta
  // generateAuthToken()
  const initiateTransaction = async () => {
    if (!activeConfig) {
      throw new Error('No hay configuración de pago activa. Por favor, configure Paymentez en el panel de administración.');
    }
    
    const apiUrl = `${activeConfig.api_url}/v2/transaction/init_reference/`;

    // Ejemplo donde en Ecuador se paga el 12% de IVA
    // solo deben tener 2 decimales

    const amount = total.toFixed(2);
    const taxable_amount = taxable.toFixed(2);
    const vat = taxes.toFixed(2);

    //se genera el token
    const authToken = await generateAuthToken();
    
    console.log('Using API URL:', apiUrl);
    console.log('Payment environment:', activeConfig.environment);

    // Crear el objeto order base
    const orderData: any = {
      amount: amount,
      description: "Pago inicial alquiler buceo",
      vat: vat,
      dev_reference: Math.floor(Math.random() * (150000 - 10000 + 1)) + 10000
    };

    // Solo agregar taxable_amount y tax_percentage si vat no es 0
    if (parseFloat(vat) !== 0) {
      orderData.taxable_amount = taxable_amount;
      orderData.tax_percentage = 0;
    }

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Auth-Token": authToken,
      },
      body: JSON.stringify({
        locale: "es",
        order: orderData,
        user: {
          id: id, //Cualquier id que se ponga, puede ser alfanumérico
          email: email,
          phone: telefono,
        },
        conf: {
          style_version: "2",
        }
      })
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
        disabled={disabled || !configLoaded || !activeConfig}
      >
        {!configLoaded ? 'Cargando configuración...' : 'Pagar con tarjeta de crédito/débito'}
      </Button>
    </div>
  );
};

export default PaymentButton;