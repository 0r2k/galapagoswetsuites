'use client'

import { useState, useEffect, Suspense } from 'react'
import { redirect, useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabaseClient'
import { differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import Script from 'next/script'
import ReactFlagsSelect from 'react-flags-select'
import { 
  Customer,
  createCustomer, 
  updateCustomer, 
  getCurrentCustomer,
  createRentalOrder,
  createRentalItems
} from '@/lib/db'
import PaymentButton from '@/components/payment-button'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rentalData = searchParams.get('rentalData')

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [rental, setRental] = useState<any>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  
  // Formulario de cliente
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [nationality, setNationality] = useState('')
  
  // Estados de validación
  const [validationErrors, setValidationErrors] = useState({
    firstName: false,
    lastName: false,
    email: false,
    phone: false
  })
  
  // Función para cargar el carrito desde localStorage
  function loadCartFromLocalStorage() {
    if (typeof window === 'undefined') return null;
    const savedCart = localStorage.getItem('galapagosCart')
    if (!savedCart) return null;
    
    try {
      const parsedCart = JSON.parse(savedCart)
      return parsedCart.map((item: any) => ({
        ...item,
        startDate: item.startDate ? new Date(item.startDate) : undefined,
        endDate: item.endDate ? new Date(item.endDate) : undefined
      }))
    } catch (error) {
      console.error('Error al cargar el carrito desde localStorage:', error)
      return null
    }
  }

  // Funciones de cálculo de precios
  const calculateProductsSubtotal = (rental: any) => {
    return ((rental.totalPrice - rental.returnFeeAmount) * rental.rentalDays).toFixed(2)
  }
  
  const calculateReturnFee = (rental: any) => {
    return rental.returnFeeAmount.toFixed(2)
  }
  
  const calculateSubtotal = (rental: any) => {
    return ((rental.totalPrice - rental.returnFeeAmount) * rental.rentalDays + rental.returnFeeAmount).toFixed(2)
  }
  
  const calculateTaxes = (rental: any) => {
    return (rental.items ? rental.items.reduce((total: number, item: any) => {
      const taxRate = item.product.tax_percentage || 0;
      return total + (item.product.public_price * item.quantity * rental.rentalDays * taxRate);
    }, 0) : rental.totalPrice * rental.rentalDays * 0).toFixed(2)
  }

  const calculateTotal = (rental: any) => {
    const subtotal = (rental.totalPrice - rental.returnFeeAmount) * rental.rentalDays + rental.returnFeeAmount
    const taxes = rental.items ? rental.items.reduce((total: number, item: any) => {
      const taxRate = item.product.tax_percentage || 0;
      return total + (item.product.public_price * item.quantity * rental.rentalDays * taxRate);
    }, 0) : (rental.totalPrice * rental.rentalDays * 0)
    return (subtotal + taxes).toFixed(2)
  }

  const calculateInitialPayment = (rental: any) => {
    if (!rental.items) return 0
    
    // Pago inicial = diferencia entre precio público y costo proveedor
    const initialPayment = rental.items.reduce((total: number, item: any) => {
      const priceDifference = (item.product.public_price - item.product.supplier_cost) * item.quantity * rental.rentalDays
      return total + priceDifference
    }, 0)
    
    return Math.max(initialPayment, 0) // Asegurar que no sea negativo
  }
  
  // Función de validación
  const validateForm = () => {
    const errors = {
      firstName: !firstName.trim(),
      lastName: !lastName.trim(),
      email: !email.trim(),
      phone: !phone.trim()
    }
    
    setValidationErrors(errors)
    
    // Si hay errores, mostrar toast con los campos faltantes
    const hasErrors = Object.values(errors).some(error => error)
    if (hasErrors) {
      const missingFields = []
      if (errors.firstName) missingFields.push('Nombre')
      if (errors.lastName) missingFields.push('Apellido')
      if (errors.email) missingFields.push('Email')
      if (errors.phone) missingFields.push('Teléfono')
      
      toast.error(`Por favor complete los siguientes campos: ${missingFields.join(', ')}`)
    }
    
    // Retorna true si no hay errores
    return !hasErrors
  }
  
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        if (user) {
          const customerData = await getCurrentCustomer()
          if (customerData) {
            setCustomer(customerData)
            setFirstName(customerData.first_name || '')
            setLastName(customerData.last_name || '')
            setEmail(customerData.email || '')
            setPhone(customerData.phone || '')
          }
        }
        
        // Intentar cargar datos desde localStorage primero
        const cartItems = loadCartFromLocalStorage()
        
        if (cartItems && cartItems.length > 0) {
          // Calcular días de alquiler
          const calculateRentalDays = (): number => {
            const item = cartItems[0];
            if (!item.startDate || !item.endDate || !item.startTime || !item.endTime) {
              return 0;
            }
            
            // Extraer horas de los strings de hora (formato "HH:MM")
            const startHour = parseInt(item.startTime.split(':')[0])
            const endHour = parseInt(item.endTime.split(':')[0])
            
            // Calcular días base
            let days = differenceInDays(new Date(item.endDate), new Date(item.startDate))
            
            // Aplicar reglas de horario
            if (startHour >= 17) days -= 1;
            if (endHour >= 17) days += 1;
            
            // Asegurar que al menos sea 1 día
            return Math.max(1, days);
          };
          
          // Calcular precio total
          const calculateTotal = () => {
            let baseTotal = cartItems.reduce((total: number, item: any) => {
              return total + (item.product.public_price * item.quantity)
            }, 0);
            
            // Aplicar tarifa de devolución si existe
            const returnIsland = cartItems[0].returnIsland;
            let returnFeeAmount = 0;
            
            // Intentar obtener la tarifa de devolución desde localStorage
            try {
              const savedReturnFee = localStorage.getItem('galapagosReturnFee');
              if (savedReturnFee) {
                const parsedReturnFee = JSON.parse(savedReturnFee);
                if (parsedReturnFee.island === returnIsland) {
                  returnFeeAmount = parsedReturnFee.amount;
                }
              }
            } catch (error) {
              console.error('Error al cargar la tarifa de devolución:', error);
            }
            
            // Si no se pudo obtener de localStorage, usar valor por defecto
            if (returnFeeAmount === 0 && returnIsland === 'san-cristobal') {
              returnFeeAmount = 5; // Tarifa por defecto para San Cristóbal
            }
            
            // Calcular cantidad total de items para aplicar la tarifa por cada 3 productos
            const totalItems = cartItems.reduce((total: number, item: any) => total + item.quantity, 0);
            // Multiplicar por cada grupo de 3 items (redondeado hacia arriba)
            const multiplier = Math.ceil(totalItems / 3);
            returnFeeAmount = returnFeeAmount * multiplier;
            
            baseTotal += returnFeeAmount;
            
            // Multiplicamos por los días de alquiler (sin incluir la tarifa de devolución)
            return {
              baseTotal: baseTotal,
              returnFeeAmount: returnFeeAmount
            };
          };
          
          const { baseTotal, returnFeeAmount } = calculateTotal();
          
          const rentalData = {
            items: cartItems,
            totalPrice: baseTotal,
            returnFeeAmount: returnFeeAmount,
            rentalDays: calculateRentalDays(),
            startDate: cartItems[0].startDate,
            endDate: cartItems[0].endDate,
            startTime: cartItems[0].startTime,
            endTime: cartItems[0].endTime,
            returnIsland: cartItems[0].returnIsland
          };
          
          setRental(rentalData);
        } 
        // Si no hay datos en localStorage, intentar usar los datos de la URL
        else if (rentalData) {
          const decodedRental = JSON.parse(decodeURIComponent(rentalData))
          // Convertir fechas a objetos Date si existen
          if (decodedRental.startDate) {
            decodedRental.startDate = new Date(decodedRental.startDate)
          }
          if (decodedRental.endDate) {
            decodedRental.endDate = new Date(decodedRental.endDate)
          }
          setRental(decodedRental)
        } else {
          // Si no hay datos de alquiler, redirigir a la página principal
          router.push('/')
        }
      } catch (error) {
        console.error('Error checking user:', error)
      } finally {
        setLoading(false)
      }
    }
    
    checkUser()
  }, [])
  
  const handleSubmit = async (e: React.FormEvent, data?: any) => {
    e.preventDefault()
    
    if (!rental) {
      return
    }
    
    try {
      setProcessingPayment(true)
      
      // Validar que tenemos todos los datos necesarios
      if (!firstName || !lastName || !email) {
        alert('Por favor, complete todos los campos requeridos')
        return
      }
      
      // Crear un cliente anónimo (sin cuenta de usuario)
      let customerId = customer?.id
      
      if (!customerId) {
        // Crear un nuevo cliente sin usuario asociado
        const newCustomer = await createCustomer({
          user_id: null,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          nationality: nationality, // Agregamos la nacionalidad
          uid: userId,
        })
        
        customerId = newCustomer.id
      } else if (customer) {
        // Actualizar información del cliente existente
        await updateCustomer(customer.id, {
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          email: email,
          nationality: nationality // Actualizamos la nacionalidad
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
      
      // Crear la orden de alquiler (exitosa o fallida para tracking)
      const order = await createRentalOrder({
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
        notes: ''
      })
      
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
      await createRentalItems(rentalItems)
      
      if (isTransactionSuccessful) {
        // Redirigir a la página de confirmación solo si la transacción fue exitosa
        router.push(`/checkout/confirmation?orderId=${order.id}`)
      } else {
        // Mostrar error pero permitir que se registre el intento fallido
        const errorMessage = transactionStatusDetail === 1 ? 'Verificación requerida' :
        transactionStatusDetail === 6 ? 'Fraude' :
        transactionStatusDetail === 7 ? 'Reembolso' :
        transactionStatusDetail === 8 ? 'Devolución de cargo' :
        transactionStatusDetail === 9 ? 'Rechazado por el carrier' :
        'Error del sistema.'

        const transactionMessage = data?.transaction?.message;
        if(transactionMessage == 'Establecimiento invalido') {
          setErrorMessage('Oops! There was a problem with your payment. Please try again with a MasterCard o Visa credit/debit card or contact me via email or whatsapp so we can change to another payment method.')
        } else if(transactionMessage == 'Tx invalida' || transactionMessage == 'No tarjeta de credito') {
              setErrorMessage('Oops! There was a problem with your payment. Please try again with a valid credit/debit card or contact me via email or whatsapp so we can change to another payment method.')
        } else if(transactionMessage == 'Tarjeta expirada') {
          setErrorMessage('Oops! It seems your card has expired. Please try again with another credit/debit card or contact me via email or whatsapp so we can change to another payment method.')
        } else if(transactionMessage == 'Tarjeta en boletin') {
          setErrorMessage('Oops! It seems you can\'t use this card temporarily. Please try again with another credit/debit card or contact me via email or whatsapp so we can change to another payment method.')
        } else if(transactionMessage == 'Fondos insuficientes') {
          setErrorMessage('Oops! There was a problem with your payment. Please try again with a credit/debit card with enough funds or contact me via email or whatsapp so we can change to another payment method.')
        } else if(transactionMessage == 'Error en numero de tarjeta') {
          setErrorMessage('Oops! There was a problem with your payment. Please try again with another credit/debit card or contact me via email or whatsapp so we can change to another payment method.')
        } else if(transactionMessage == 'Numero de autorizacion no existe') {
          setErrorMessage('Oops! There was a problem with your payment. Please try again with another credit/debit card or contact me via email or whatsapp so we can change to another payment method.')
        } else {
          setErrorMessage('Oops! There was a problem with your payment. Please try again with another credit/debit card or contact me via email or whatsapp so we can change to another payment method.')
        }
        
        toast.error(errorMessage, { description: transactionMessage })
      }
      
    } catch (error) {
      console.error('Error processing payment:', error)
      alert('Error al procesar el pago. Por favor, inténtelo de nuevo.')
    } finally {
      setProcessingPayment(false)
    }
  }
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>
  }
  
  if (!rental) {
    return <div className="flex items-center justify-center h-screen">No hay datos de alquiler disponibles</div>
  }
  
  // Variables para el PaymentButton
  const userId = user?.id || `guest_${Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000}`
  const initialPaymentAmount = calculateInitialPayment(rental)
  const taxable = initialPaymentAmount
  const taxes = 0 // Los impuestos se cobran al recoger, no en el pago inicial
  const totalAmount = initialPaymentAmount
  
  const createOrder = (response: any) => {
    // Crear un evento sintético para handleSubmit
    const syntheticEvent = {
      preventDefault: () => {}
    } as React.FormEvent
    return handleSubmit(syntheticEvent, response)
  }
  // const handlePaymentResponse = (transaction: any) => {
  //   console.log('Payment response:', transaction)
  //   // Aquí puedes manejar la respuesta del pago
  //   if (transaction.status_detail != 3) {
  //     toast.error('Error al procesar el pago. Por favor, inténtelo de nuevo.')
  //   }
  // }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 px-4">Finalizar Compra</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Información Personal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input 
                      id="firstName" 
                      value={firstName} 
                      onChange={(e) => {
                        setFirstName(e.target.value)
                        if (validationErrors.firstName) {
                          setValidationErrors(prev => ({ ...prev, firstName: false }))
                        }
                      }} 
                      required 
                      className={`bg-white border border-gray-400 rounded-md ${validationErrors.firstName ? 'border-red-500 ring-red-500' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input 
                      id="lastName" 
                      value={lastName} 
                      onChange={(e) => {
                        setLastName(e.target.value)
                        if (validationErrors.lastName) {
                          setValidationErrors(prev => ({ ...prev, lastName: false }))
                        }
                      }} 
                      required
                      className={`bg-white border border-gray-400 rounded-md ${validationErrors.lastName ? 'border-red-500 ring-red-500' : ''}`}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={email} 
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (validationErrors.email) {
                          setValidationErrors(prev => ({ ...prev, email: false }))
                        }
                      }} 
                      required 
                      className={`bg-white border border-gray-400 rounded-md ${validationErrors.email ? 'border-red-500 ring-red-500' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input 
                      id="phone" 
                      value={phone} 
                      onChange={(e) => {
                        setPhone(e.target.value)
                        if (validationErrors.phone) {
                          setValidationErrors(prev => ({ ...prev, phone: false }))
                        }
                      }} 
                      className={`bg-white border border-gray-400 rounded-md ${validationErrors.phone ? 'border-red-500 ring-red-500' : ''}`}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nacionalidad</Label>
                  <ReactFlagsSelect
                    selected={nationality}
                    onSelect={(code: string) => setNationality(code)}
                    searchable
                    searchPlaceholder="Buscar país..."
                    placeholder="Selecciona tu país"
                    className="bg-white"
                    selectButtonClassName="bg-white border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full justify-start"
                  />
                </div>
              </CardContent>
            </Card>

            {errorMessage && 
              <Card className="text-red-500">
                <CardHeader>
                  <CardTitle>Hubo un problema con su pago</CardTitle>
                </CardHeader>
                <CardContent>
                  {errorMessage}
                </CardContent>
              </Card>
            }
            
          </form>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Detalles del Alquiler</h3>
                <p><strong>Fecha Inicio:</strong> {rental.startDate instanceof Date ? rental.startDate.toLocaleDateString() : rental.startDate} {rental.startTime}</p>
                <p><strong>Fecha Fin:</strong> {rental.endDate instanceof Date ? rental.endDate.toLocaleDateString() : rental.endDate} {rental.endTime}</p>
                <p><strong>Días:</strong> {rental.rentalDays}</p>
                <p><strong>Isla de Devolución:</strong> {rental.returnIsland === 'santa-cruz' ? 'Santa Cruz' : 'San Cristóbal'}</p>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-medium mb-2">Productos</h3>
                <ul className="space-y-2">
                  {rental.items && rental.items.map((item: any, index: number) => (
                    <li key={index} className="flex justify-between">
                      <span>{item.product.name} x{item.quantity}</span>
                      <span>${(item.product.public_price * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <Separator />
              
              <div>
                <div className="flex justify-between">
                  <span>Productos ({rental.rentalDays} días de alquiler)</span>
                  <span>${calculateProductsSubtotal(rental)}</span>
                </div>
                {rental.returnFeeAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Devolución en {rental.returnIsland === 'santa-cruz' ? 'Santa Cruz' : 'San Cristóbal'}</span>
                    <span>${calculateReturnFee(rental)}</span>
                  </div>
                )}
                {parseFloat(calculateTaxes(rental)) > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${calculateSubtotal(rental)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Impuestos</span>
                    <span>${calculateTaxes(rental)}</span>
                  </div>
                </>
                )}
              </div>
              <Separator />
              <div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Pago inicial:</span>
                  <span>${calculateInitialPayment(rental).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Pagar al recoger:</span>
                  <span>${(parseFloat(calculateTotal(rental)) - calculateInitialPayment(rental)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>${calculateTotal(rental)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <PaymentButton 
            email={email}
            telefono={phone}
            id={userId}
            nombreCompleto={firstName + ' ' + lastName}
            taxable={taxable}
            taxes={taxes}
            total={totalAmount}
            callbackOrden={createOrder}
            // handleResponse={handlePaymentResponse}
            disabled={processingPayment}
            onValidate={validateForm}
          />
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <>
      {/* Paymentez Libraries - Solo cargados en checkout */}
      <Script src="https://code.jquery.com/jquery-3.5.0.min.js" />
      <Script src="https://cdn.paymentez.com/ccapi/sdk/payment_checkout_3.0.0.min.js" />
      
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando...</div>}>
        <CheckoutContent />
      </Suspense>
    </>
  )
}