'use client'
import { useEffect, useRef, useState } from "react"
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
  disabled,
  onValidate
}: any) => {

  const paymentCheckoutRef = useRef<any>(null);
  const [paymentEnvironment, setPaymentEnvironment] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Cargar configuración de pago al montar el componente
  useEffect(() => {
    const loadPaymentConfig = async () => {
      try {
        const response = await fetch('/api/payment/config');
        if (response.ok) {
          const data = await response.json();
          setPaymentEnvironment(data.environment);
        } else {
          console.error('Error loading payment config:', response.statusText);
        }
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
      if (!configLoaded || !paymentEnvironment) {
        // console.error('No hay configuración de pago activa');
        return;
      }
      
      // Obtener configuración completa para el modal
      const configResponse = await fetch('/api/payment/config');
      if (!configResponse.ok) {
        console.error('Error obteniendo configuración para modal');
        return;
      }
      const configData = await configResponse.json();
      
      //@ts-ignore
      paymentCheckoutRef.current = new window.PaymentCheckout.modal({
        locale: 'es',
        env_mode: configData.environment,
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

  }, [paymentEnvironment, configLoaded]);

  // La siguiente función genera la referencia usando el nuevo endpoint
  const initiateTransaction = async () => {
    if (!paymentEnvironment) {
      throw new Error('No hay configuración de pago activa. Por favor, configure Paymentez en el panel de administración.');
    }

    // Ejemplo donde en Ecuador se paga el 12% de IVA
    // solo deben tener 2 decimales

    const amount = total.toFixed(2);
    const taxable_amount = taxable.toFixed(2);
    const vat = taxes.toFixed(2);
    
    console.log('Payment environment:', paymentEnvironment);

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

    const requestData = {
       orderData: orderData,
       user: {
         id: id, //Cualquier id que se ponga, puede ser alfanumérico
         email: email,
         phone: telefono,
       }
     };

    try {
      const response = await fetch('/api/payment/init-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error('Error al inicializar la transacción');
      }

      const data = await response.json();
      return data.reference;
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  };

  // Con el llamado y obtención de la referencia se ejecuta la función open
  // del paymentCheckout pasándola como parámetro en un objeto
  const handleButtonClick = async () => {
    // Ejecutar validación si existe
    if (onValidate && !onValidate()) {
      return; // No proceder si la validación falla
    }
    
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
        disabled={disabled || !configLoaded || !paymentEnvironment}
      >
        {!configLoaded ? 'Cargando configuración...' : 'Pagar con tarjeta de crédito/débito'}
      </Button>
    </div>
  );
};

export default PaymentButton;