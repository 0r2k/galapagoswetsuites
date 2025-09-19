'use client'
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Button } from "./ui/button";
import { toast } from "sonner"
import { 
  createCustomer, 
  updateCustomer, 
  getCurrentCustomer,
  RentalOrder
} from '@/lib/db'

const PaymentButton = ({
  id,
  taxable,
  taxes,
  total,
  formData,
  rental,
  customer,
  disabled,
  onValidate,
}: any) => {

  const t = useTranslations('payment');
  const paymentCheckoutRef = useRef<any>(null);
  const [paymentEnvironment, setPaymentEnvironment] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const capturedFormDataRef = useRef<any>(null);
  const router = useRouter();
  const params = useParams();
  const locale = params.locale || 'es';

  // Función para crear la orden (movida desde checkout)
  const createOrder = async (data: any, capturedFormData: any) => {
    if (!rental) {
      return
    }
    
    try {
      let customerId = customer?.id
      
      if (!customerId) {
        // Crear un nuevo cliente sin usuario asociado
        try {
          const newCustomer = await createCustomer({
            user_id: null,
            first_name: capturedFormData.firstName,
            last_name: capturedFormData.lastName,
            email: capturedFormData.email,
            phone: capturedFormData.phone,
            nationality: capturedFormData.nationality, // Agregamos la nacionalidad
            uid: id,
          })
          
          customerId = newCustomer.id
        } catch (error: any) {
          console.error('Error al crear cliente:', error)
          
          // Si es un error de conflicto, intentar buscar el usuario existente
          if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('conflict')) {
            const existingCustomer = await getCurrentCustomer()
            if (existingCustomer) {
              customerId = existingCustomer.id
            } else {
              throw new Error('No se pudo crear o encontrar el cliente')
            }
          } else {
            throw error
          }
        }
      } else if (customer) {
        // Actualizar información del cliente existente
        await updateCustomer(customer.id, {
          first_name: capturedFormData.firstName,
          last_name: capturedFormData.lastName,
          phone: capturedFormData.phone,
          email: capturedFormData.email,
          nationality: capturedFormData.nationality // Actualizamos la nacionalidad
        })
      }
      
      if (!customerId) {
        throw new Error('No se pudo crear o actualizar el cliente')
      }
      
      // Verificar el estado de la transacción
      const transactionStatusDetail = data?.transaction?.status_detail
      const isTransactionSuccessful = transactionStatusDetail === 3
      
      // Calcular el total y el IVA
      const subtotal = rental.totalPrice
      const taxRate = 0 // 12% IVA en Ecuador
      const taxAmount = subtotal * taxRate
      const totalAmount = subtotal + taxAmount

      const orderToSave = {
        auth_code: data?.transaction?.authorization_code || '',
        bin: data?.card?.bin || '',
        customer_id: customerId,
        dev_reference: data?.transaction?.dev_reference || Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
        start_date: rental.startDate,
        start_time: rental.startTime,
        end_date: rental.endDate,
        end_time: rental.endTime,
        return_island: rental.returnIsland || 'santa-cruz',
        total_amount: data?.transaction?.amount || totalAmount,
        tax_amount: taxAmount,
        payment_method: data?.card?.type || 'card',
        payment_status: isTransactionSuccessful ? 'paid' : 'pending',
         status: isTransactionSuccessful ? 'completed' : 'cancelled',
        status_detail: data?.transaction?.status_detail || '',
        transaction_id: data?.transaction?.id || '',
        notes: '',
        language: locale
      };

      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderToSave),
      });
      
      if (!response.ok) {
        throw new Error('Error al crear la orden');
      }
      
      const order: RentalOrder = await response.json();
      
      // Crear la orden de alquiler (exitosa o fallida para tracking)
      // const order = await createRentalOrder({
      //   auth_code: data?.transaction?.authorization_code || '',
      //   bin: data?.card?.bin || '',
      //   customer_id: customerId,
      //   dev_reference: data?.transaction?.dev_reference || Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
      //   start_date: rental.startDate,
      //   start_time: rental.startTime,
      //   end_date: rental.endDate,
      //   end_time: rental.endTime,
      //   return_island: rental.returnIsland || 'santa-cruz',
      //   total_amount: data?.transaction?.amount || totalAmount,
      //   tax_amount: taxAmount,
      //   payment_method: data?.card?.type || 'card',
      //   payment_status: isTransactionSuccessful ? 'paid' : 'pending',
      //    status: isTransactionSuccessful ? 'completed' : 'cancelled',
      //   status_detail: data?.transaction?.status_detail || '',
      //   transaction_id: data?.transaction?.id || '',
      //   notes: ''
      // })
      
      // Crear los items de alquiler basados en los productos del carrito
      const rentalItems = rental.items.map((item: any) => ({
        order_id: order.id,
        product_config_id: item.product.id,
        quantity: item.quantity,
        days: rental.rentalDays,
        unit_price: item.product.public_price,
        subtotal: item.product.public_price * item.quantity * rental.rentalDays
      }))
      
      // Guardar los items
      // await createRentalItems(rentalItems)
      await fetch("/api/rentals/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rentalItems),
      });
      
      if (isTransactionSuccessful) {
        // Redirigir a la página de confirmación solo si la transacción fue exitosa
        router.push(`/${locale}/checkout/confirmation?orderId=${order.id}`)
      } else {
        // Mostrar error pero permitir que se registre el intento fallido
        const errorMessage = transactionStatusDetail === 1 ? 'Verificación requerida' :
        transactionStatusDetail === 6 ? 'Fraude' :
        transactionStatusDetail === 7 ? 'Reembolso' :
        transactionStatusDetail === 8 ? 'Devolución de cargo' :
        transactionStatusDetail === 9 ? 'Rechazado por el carrier' :
        'Error del sistema.'

        const transactionMessage = data?.transaction?.message;
        let finalErrorMessage = '';
        
        if(transactionMessage == 'Establecimiento invalido') {
          finalErrorMessage = 'Oops! There was a problem with your payment. Please try again with a MasterCard o Visa credit/debit card or contact me via email or whatsapp so we can change to another payment method.'
        } else if(transactionMessage == 'Tx invalida' || transactionMessage == 'No tarjeta de credito') {
          finalErrorMessage = 'Oops! There was a problem with your payment. Please try again with a valid credit/debit card or contact me via email or whatsapp so we can change to another payment method.'
        } else if(transactionMessage == 'Tarjeta expirada') {
          finalErrorMessage = 'Oops! It seems your card has expired. Please try again with another credit/debit card or contact me via email or whatsapp so we can change to another payment method.'
        } else if(transactionMessage == 'Tarjeta en boletin') {
          finalErrorMessage = 'Oops! It seems you can\'t use this card temporarily. Please try again with another credit/debit card or contact me via email or whatsapp so we can change to another payment method.'
        } else if(transactionMessage == 'Fondos insuficientes') {
          finalErrorMessage = 'Oops! There was a problem with your payment. Please try again with a credit/debit card with enough funds or contact me via email or whatsapp so we can change to another payment method.'
        } else if(transactionMessage == 'Error en numero de tarjeta') {
          finalErrorMessage = 'Oops! There was a problem with your payment. Please try again with another credit/debit card or contact me via email or whatsapp so we can change to another payment method.'
        } else if(transactionMessage == 'Numero de autorizacion no existe') {
          finalErrorMessage = 'Oops! There was a problem with your payment. Please try again with another credit/debit card or contact me via email or whatsapp so we can change to another payment method.'
        } else {
          finalErrorMessage = 'Oops! There was a problem with your payment. Please try again with another credit/debit card or contact me via email or whatsapp so we can change to another payment method.'
        }
        
        toast.error(errorMessage, { description: finalErrorMessage })
      }
      
    } catch (error) {
      console.error('Error processing payment:', error)
      alert('Error al procesar el pago. Por favor, inténtelo de nuevo.')
    }
  }

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
          // handleResponse(response.transaction);   
          // función que guarda la orden en una base de datos  
          console.log(response);     
          createOrder(response, capturedFormDataRef.current); 
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

    const amount: number = parseFloat(total.toFixed(2));
    const taxable_amount: number = parseFloat(taxable.toFixed(2));
    const vat: number = parseFloat(taxes.toFixed(2));
    
    console.log('Payment environment:', paymentEnvironment);

    // Crear el objeto order base
    const orderData: any = {
      amount,
      description: "Pago inicial alquiler buceo",
      tax_percentage: 0,
      vat,
      dev_reference: String(Math.floor(Math.random() * (150000 - 10000 + 1)) + 10000),
    };

    // Solo agregar taxable_amount y tax_percentage si vat no es 0
    if (vat > 0) {
      orderData.taxable_amount = taxable_amount;
      orderData.tax_percentage = 0;
    }

    const requestData = {
       orderData: orderData,
       user: {
         id: id, //Cualquier id que se ponga, puede ser alfanumérico
         email: formData.email,
         phone: formData.phone,
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
    
    // Capturar formData al momento del click para preservar los datos
    capturedFormDataRef.current = { ...formData };
    
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
        {!configLoaded ? t('loadingConfig') : t('payWithCard')}
      </Button>
    </div>
  );
};

export default PaymentButton;