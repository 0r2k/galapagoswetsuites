'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabaseClient'
import { differenceInDays } from 'date-fns'
import { 
  Customer, 
  RentalOrder,
  createCustomer, 
  updateCustomer, 
  getCurrentCustomer,
  createRentalOrder,
  createRentalItems
} from '@/lib/db'

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rentalData = searchParams.get('rentalData')
  
  const [loading, setLoading] = useState(true)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [rental, setRental] = useState<any>(null)
  
  // Formulario de cliente
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [nationality, setNationality] = useState('')
  
  // Formulario de pago
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [cvv, setCvv] = useState('')
  
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
            if (returnIsland) {
              // Aquí deberíamos obtener las tarifas de devolución de la base de datos
              // Por ahora, usamos un valor fijo si es San Cristóbal
              if (returnIsland === 'san-cristobal') {
                baseTotal += 10; // Valor ejemplo
              }
            }
            
            // Multiplicamos por los días de alquiler
            return baseTotal;
          };
          
          const rentalData = {
            items: cartItems,
            totalPrice: calculateTotal(),
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
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!rental) {
      return
    }
    
    try {
      setProcessingPayment(true)
      
      // Crear un cliente anónimo (sin cuenta de usuario)
      let customerId = customer?.id
      
      if (!customerId) {
        // Crear un nuevo cliente sin usuario asociado
        const newCustomer = await createCustomer({
          user_id: null, // No asociamos a un usuario
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          nationality: nationality // Agregamos la nacionalidad
        })
        
        customerId = newCustomer.id
      } else if (customer) {
        // Actualizar información del cliente existente
        await updateCustomer(customer.id, {
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          nationality: nationality // Actualizamos la nacionalidad
        })
      }
      
      if (!customerId) {
        throw new Error('No se pudo crear o actualizar el cliente')
      }
      
      // Calcular el total y el IVA
      const subtotal = rental.totalPrice
      const taxRate = 0.12 // 12% IVA en Ecuador
      const taxAmount = subtotal * taxRate
      const totalAmount = subtotal + taxAmount
      
      // Crear la orden de alquiler
      const order = await createRentalOrder({
        customer_id: customerId,
        start_date: rental.startDate,
        start_time: rental.startTime,
        end_date: rental.endDate,
        end_time: rental.endTime,
        return_island: rental.returnIsland || 'santa-cruz',
        total_amount: totalAmount,
        tax_amount: taxAmount,
        status: 'confirmed', // Confirmado automáticamente al pagar
        payment_status: 'paid',
        notes: ''
      })
      
      // Crear los items de alquiler
      const rentalItems = []
      
      // Traje de buceo
      if (rental.wetsuitType && rental.size) {
        rentalItems.push({
          order_id: order.id,
          product_config_id: `wetsuit-${rental.wetsuitType}-${rental.ageGroup}-${rental.size}`,
          quantity: 1,
          days: rental.days,
          unit_price: rental.wetsuitPrice,
          subtotal: rental.wetsuitPrice * rental.days
        })
      }
      
      // Snorkel
      if (rental.includeSnorkel) {
        rentalItems.push({
          order_id: order.id,
          product_config_id: 'snorkel',
          quantity: 1,
          days: rental.days,
          unit_price: rental.snorkelPrice,
          subtotal: rental.snorkelPrice * rental.days
        })
      }
      
      // Aletas
      if (rental.includeFins && rental.footSize) {
        rentalItems.push({
          order_id: order.id,
          product_config_id: `fins-${rental.footSize}`,
          quantity: 1,
          days: rental.days,
          unit_price: rental.finsPrice,
          subtotal: rental.finsPrice * rental.days
        })
      }
      
      // Guardar los items
      await createRentalItems(rentalItems)
      
      // Redirigir a la página de confirmación
      router.push(`/checkout/confirmation?orderId=${order.id}`)
      
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
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Finalizar Compra</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit}>
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Información Personal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input 
                      id="firstName" 
                      value={firstName} 
                      onChange={(e) => setFirstName(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input 
                      id="lastName" 
                      value={lastName} 
                      onChange={(e) => setLastName(e.target.value)} 
                      required 
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input 
                      id="phone" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="nationality">Nacionalidad</Label>
                  <Input 
                    id="nationality" 
                    value={nationality} 
                    onChange={(e) => setNationality(e.target.value)} 
                    required 
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Información de Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="cardName">Nombre en la Tarjeta</Label>
                  <Input 
                    id="cardName" 
                    value={cardName} 
                    onChange={(e) => setCardName(e.target.value)} 
                    required 
                  />
                </div>
                
                <div>
                  <Label htmlFor="cardNumber">Número de Tarjeta</Label>
                  <Input 
                    id="cardNumber" 
                    value={cardNumber} 
                    onChange={(e) => setCardNumber(e.target.value)} 
                    required 
                    placeholder="XXXX XXXX XXXX XXXX"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiryDate">Fecha de Expiración</Label>
                    <Input 
                      id="expiryDate" 
                      value={expiryDate} 
                      onChange={(e) => setExpiryDate(e.target.value)} 
                      required 
                      placeholder="MM/AA"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cvv">CVV</Label>
                    <Input 
                      id="cvv" 
                      value={cvv} 
                      onChange={(e) => setCvv(e.target.value)} 
                      required 
                      placeholder="123"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={processingPayment}
            >
              {processingPayment ? 'Procesando...' : 'Completar Pago'}
            </Button>
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
                  <span>Subtotal</span>
                  <span>${rental.totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (12%)</span>
                  <span>${(rental.totalPrice * 0.12).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold mt-2">
                  <span>Total</span>
                  <span>${(rental.totalPrice * 1.12).toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  <p>Precio por {rental.rentalDays} día(s) de alquiler</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}