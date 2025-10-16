'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabaseClient'
import { differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import Script from 'next/script'
import ReactFlagsSelect from 'react-flags-select'
import { 
  Customer,
  getCurrentCustomer
} from '@/lib/db'
import PaymentButton from '@/components/payment-button'
import { useTranslations } from 'next-intl'

function CheckoutContent() {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const locale = params.locale || 'es'
  const rentalData = searchParams.get('rentalData')

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [rental, setRental] = useState<any>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)
  
  // Formulario de cliente - usando un objeto formData
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nationality: ''
  })
  
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
    
    // Agregar $5 si el pickup es en hotel
    const hotelPickupFee = (rental.pickup && rental.pickup !== "santa-cruz") ? 5 : 0
    
    return (subtotal + taxes + hotelPickupFee).toFixed(2)
  }

  const calculateInitialPayment = (rental: any) => {
    if (!rental || !rental.items) return 0
    
    // Pago inicial = diferencia entre precio público y costo proveedor
    const initialPayment = rental.items.reduce((total: number, item: any) => {
      const priceDifference = (item.product.public_price - item.product.supplier_cost) * item.quantity * rental.rentalDays
      return total + priceDifference
    }, 0)
    
    // Agregar $5 si el pickup es en hotel
    const hotelPickupFee = (rental.pickup && rental.pickup !== "santa-cruz") ? 5 : 0
    
    return Math.max(initialPayment + hotelPickupFee, 0) // Asegurar que no sea negativo
  }
  
  // Función de validación
  const validateForm = () => {
    const errors = {
      firstName: !formData.firstName.trim(),
      lastName: !formData.lastName.trim(),
      email: !formData.email.trim(),
      phone: !formData.phone.trim()
    }
    
    setValidationErrors(errors)
    
    // Validar que se hayan aceptado las políticas
    if (!acceptedPolicies) {
      toast.error(t('checkout.policiesRequired'))
      return false
    }
    
    // Si hay errores, mostrar toast con los campos faltantes
    const hasErrors = Object.values(errors).some(error => error)
    if (hasErrors) {
      const missingFields = []
      if (errors.firstName) missingFields.push(t('checkout.firstName'))
      if (errors.lastName) missingFields.push(t('checkout.lastName'))
      if (errors.email) missingFields.push(t('checkout.email'))
      if (errors.phone) missingFields.push(t('checkout.phone'))
      
      toast.error(t('checkout.validationError', { fields: missingFields.join(', ') }))
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
            setFormData(prev => ({
              ...prev,
              firstName: customerData.first_name || '',
              lastName: customerData.last_name || '',
              email: customerData.email || '',
              phone: customerData.phone || ''
            }))
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
            returnIsland: cartItems[0].returnIsland,
            pickup: cartItems[0].pickup,
            hotelName: cartItems[0].hotelName
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
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>
  }
  
  if (!rental) {
    return <div className="flex items-center justify-center h-screen">{t('checkout.noRentalData')}</div>
  }
  
  // Variables para el PaymentButton (después de verificar que rental existe)
  const userId = user?.id || `guest_${Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000}`
  const initialPaymentAmount = calculateInitialPayment(rental)
  const taxable = initialPaymentAmount
  const taxes = 0 // Los impuestos se cobran al recoger, no en el pago inicial
  const totalAmount = initialPaymentAmount
  
  // const handlePaymentResponse = (transaction: any) => {
  //   console.log('Payment response:', transaction)
  //   // Aquí puedes manejar la respuesta del pago
  //   if (transaction.status_detail != 3) {
  //     toast.error('Error al procesar el pago. Por favor, inténtelo de nuevo.')
  //   }
  // }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 px-4">{t('checkout.title')}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
        <div className="lg:col-span-2">
          <form>
            <Card>
              <CardHeader>
                <CardTitle>{t('checkout.personalInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t('checkout.firstName')}</Label>
                    <Input 
                      id="firstName" 
                      value={formData.firstName} 
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, firstName: e.target.value }))
                        if (validationErrors.firstName) {
                          setValidationErrors(prev => ({ ...prev, firstName: false }))
                        }
                      }} 
                      required 
                      className={`bg-white border border-gray-400 rounded-md ${validationErrors.firstName ? 'border-red-500 ring-red-500' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t('checkout.lastName')}</Label>
                    <Input 
                      id="lastName" 
                      value={formData.lastName} 
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, lastName: e.target.value }))
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
                    <Label htmlFor="email">{t('checkout.email')}</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, email: e.target.value }))
                        if (validationErrors.email) {
                          setValidationErrors(prev => ({ ...prev, email: false }))
                        }
                      }} 
                      required 
                      className={`bg-white border border-gray-400 rounded-md ${validationErrors.email ? 'border-red-500 ring-red-500' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('checkout.phone')}</Label>
                    <Input 
                      id="phone" 
                      value={formData.phone} 
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, phone: e.target.value }))
                        if (validationErrors.phone) {
                          setValidationErrors(prev => ({ ...prev, phone: false }))
                        }
                      }} 
                      className={`bg-white border border-gray-400 rounded-md ${validationErrors.phone ? 'border-red-500 ring-red-500' : ''}`}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="nationality">{t('checkout.nationality')}</Label>
                  <ReactFlagsSelect
                    selected={formData.nationality}
                    onSelect={(code: string) => setFormData(prev => ({ ...prev, nationality: code }))}
                    searchable
                    searchPlaceholder={t('checkout.searchCountry')}
                    placeholder={t('checkout.selectCountry')}
                    className="bg-white"
                    selectButtonClassName="bg-white border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full justify-start"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Checkbox para aceptar políticas de cancelación */}
            <div>
              <div className="pt-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="accept-policies"
                    checked={acceptedPolicies}
                    onCheckedChange={(checked) => setAcceptedPolicies(checked === true)}
                    className="mt-1 border-2 border-gray-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 h-6 w-6"
                  />
                  <div className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('checkout.acceptPolicies')}{' '}
                    <Dialog>
                      <DialogTrigger asChild>
                        <button 
                          type="button"
                          className="text-blue-600 hover:text-blue-800 underline font-medium"
                        >
                          {t('checkout.acceptPoliciesLink')}
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className='text-center'>{t('checkout.cancellationPolicies')}</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4">
                          <p className="text-sm text-gray-700 whitespace-pre-line text-justify">
                            {t('checkout.cancellationPoliciesText')}
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>

            {errorMessage && 
              <Card className="text-red-500">
                <CardHeader>
                  <CardTitle>{t('checkout.paymentProblem')}</CardTitle>
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
              <CardTitle>{t('checkout.orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">{t('checkout.rentalDetails')}</h3>
                <p><strong>{t('checkout.startDate')}:</strong> {rental.startDate instanceof Date ? rental.startDate.toLocaleDateString() : rental.startDate} {rental.startTime}</p>
                <p><strong>{t('checkout.endDate')}:</strong> {rental.endDate instanceof Date ? rental.endDate.toLocaleDateString() : rental.endDate} {rental.endTime}</p>
                <p><strong>{t('checkout.days')}:</strong> {rental.rentalDays}</p>
                <p><strong>{t('checkout.returnIsland')}:</strong> {rental.returnIsland === 'santa-cruz' ? t('cart.santaCruz') : t('cart.sanCristobal')}</p>
                <p><strong>{t('cart.pickupIsland')}:</strong> {
                  rental.pickup === 'santa-cruz' 
                    ? t('cart.santaCruzOffice')
                    : rental.hotelName 
                      ? `${t('cart.santaCruzHotel')} - ${rental.hotelName}`
                      : t('cart.santaCruzHotel')
                }</p>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-medium mb-2">{t('checkout.products')}</h3>
                <ul className="space-y-2">
                  {rental.items && rental.items.map((item: any, index: number) => {
                    // Obtener nombre según el idioma
                    const itemName = locale === 'en' && item.product.name_en ? item.product.name_en : item.product.name
                    
                    return (
                      <li key={index} className="flex justify-between">
                        <span>{itemName} x{item.quantity}</span>
                        <span>${(item.product.public_price * item.quantity).toFixed(2)}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
              
              <Separator />
              
              <div>
                <div className="flex justify-between">
                  <span>{t('checkout.productsSubtotal', { days: rental.rentalDays })}</span>
                  <span>${calculateProductsSubtotal(rental)}</span>
                </div>
                {rental.returnFeeAmount > 0 && (
                  <div className="flex justify-between">
                    <span>{t('checkout.returnFeeLabel', { island: rental.returnIsland === 'santa-cruz' ? t('cart.santaCruz') : t('cart.sanCristobal') })}</span>
                    <span>${calculateReturnFee(rental)}</span>
                  </div>
                )}
                {parseFloat(calculateTaxes(rental)) > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>{t('cart.subtotal')}</span>
                    <span>${calculateSubtotal(rental)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('cart.taxes')}</span>
                    <span>${calculateTaxes(rental)}</span>
                  </div>
                </>
                )}
              </div>
              <Separator />
              <div>
                <div className="flex justify-between text-lg">
                  <span className=' font-bold'>{t('cart.initialPayment')}</span>
                  <span>${calculateInitialPayment(rental).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span className=' font-bold'>{t('cart.payOnPickup')}</span>
                  <span>${(parseFloat(calculateTotal(rental)) - calculateInitialPayment(rental)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className=' font-bold'>{t('cart.total')}</span>
                  <span className=' font-bold'>${calculateTotal(rental)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <PaymentButton 
            id={userId}
            taxable={taxable}
            taxes={taxes}
            total={totalAmount}
            formData={formData}
            rental={rental}
            customer={customer}
            disabled={processingPayment}
            onValidate={validateForm}
          />
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const t = useTranslations()
  
  return (
    <>
      {/* Paymentez Libraries - Solo cargados en checkout */}
      <Script src="https://code.jquery.com/jquery-3.5.0.min.js" />
      <Script src="https://cdn.paymentez.com/ccapi/sdk/payment_checkout_3.0.0.min.js" />
      
      <Suspense fallback={<div className="flex items-center justify-center h-screen">{t('common.loading')}</div>}>
        <CheckoutContent />
      </Suspense>
    </>
  )
}