'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabaseClient'
import { getRentalOrderById } from '@/lib/db'

export default function ConfirmationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<any>(null)
  
  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        router.push('/')
        return
      }
      
      try {
        const orderData = await getRentalOrderById(orderId)
        
        // Obtener los items del pedido
        const { data: items } = await supabase
          .from('rental_items')
          .select('*')
          .eq('rental_order_id', orderId)
        
        // Obtener información del cliente
        const { data: customer } = await supabase
          .from('users')
          .select('*')
          .eq('id', orderData.customer_id)
          .single()
        
        setOrder({
          ...orderData,
          rental_items: items || [],
          customer: customer || {}
        })
      } catch (error) {
        console.error('Error loading order:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadOrder()
  }, [orderId, router])
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>
  }
  
  if (!order) {
    return <div className="flex items-center justify-center h-screen">No se encontró el pedido</div>
  }
  
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">¡Gracias por tu compra!</CardTitle>
          <p className="text-muted-foreground">Tu pedido ha sido confirmado</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-green-50 p-4 rounded-md text-center">
            <p className="text-green-700 font-medium">Número de Pedido: {order.id}</p>
            <p className="text-sm text-green-600">Hemos enviado un correo electrónico de confirmación a {order.customer.email}</p>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Detalles del Alquiler</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Fecha Inicio:</strong> {formatDate(order.start_date)} {order.start_time}</p>
                <p><strong>Fecha Fin:</strong> {formatDate(order.end_date)} {order.end_time}</p>
              </div>
              <div>
                <p><strong>Isla de Devolución:</strong> {order.return_island === 'santa-cruz' ? 'Santa Cruz' : 'San Cristóbal'}</p>
                <p><strong>Estado:</strong> Confirmado</p>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="font-medium mb-2">Productos Alquilados</h3>
            <ul className="space-y-2">
              {order.rental_items.map((item: any) => (
                <li key={item.id} className="flex justify-between">
                  <span>{item.product_config_id}</span>
                  <span>${item.subtotal.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <Separator />
          
          <div>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${(order.total_amount - order.tax_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>IVA (12%)</span>
              <span>${order.tax_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold mt-2">
              <span>Total</span>
              <span>${order.total_amount.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-medium text-blue-700 mb-2">Instrucciones de Recogida</h3>
            <p className="text-sm text-blue-600">
              Por favor, presenta tu número de pedido en nuestra tienda para recoger tu equipo de buceo.
              Nuestra tienda está ubicada en Av. Charles Darwin, Puerto Ayora, Santa Cruz, Galápagos.
              Horario: 8:00 AM - 6:00 PM todos los días.
            </p>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-center">
          <Button onClick={() => router.push('/')}>Volver al Inicio</Button>
        </CardFooter>
      </Card>
    </div>
  )
}