'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabaseClient'

function ConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const t = useTranslations('confirmation')
  const tCommon = useTranslations('common')
  const orderId = searchParams.get('orderId')
  
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<any>(null)
  const [returnFees, setReturnFees] = useState<{id: string, name: string, location: string, amount: number}[]>([])
  
  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        router.push('/')
        return
      }
      
      try {
        const data = await fetch('/api/rentals/' + orderId)
        if (!data.ok) {
          throw new Error('Failed to fetch order')
        }
        const orderData = await data.json()
        
        setOrder(orderData)
        
        // Enviar emails automáticos después de cargar el pedido
        if (orderData.status > 0 && orderData.status < 2) {
          try {
            const emailResponse = await fetch('/api/send-order-emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                orderId,
                language: locale 
              })
            })
            
            if (emailResponse.ok) {
              const emailResult = await emailResponse.json()
              // console.log('Emails enviados:', emailResult.message)
              // Actualizar status a 2 (Enviado) { antes era sent_email } después de enviar correctamente
              const statusResponse = await fetch(`/api/rentals/${orderId}/status`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 2 }), // 2 = Email enviado
              })
               
              if (statusResponse.ok) {
                console.log('Status actualizado status a Enviado')
              } else {
                const statusError = await statusResponse.json()
                console.error('Error actualizando status:', statusError)
              }
            } else {
              console.error('Error enviando emails:', await emailResponse.text())
            }
          } catch (emailError) {
            console.error('Error al enviar emails automáticos:', emailError)
          }
        } else {
          console.log('Los emails ya fueron enviados para este pedido')
        }
        
      } catch (error) {
        console.error('Error loading order:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadOrder()
  }, [orderId, router])

  useEffect(() => {
    const fetchReturnFees = async () => {
      try {
        const { data, error } = await supabase
          .from('additional_fees')
          .select('id, name, location, amount')
          .eq('fee_type', 'island_return_fee')
          .eq('active', true)
          
        if (error) {
          throw error
        }
        
        if (data) {
          setReturnFees(data)
        }
      } catch (error) {
        console.error('Error al cargar tarifas de devolución:', error)
      }
    }
    
    fetchReturnFees()
  }, [])
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const calculateReturnFee = () => {
    if (!order || order.return_island !== 'san-cristobal' || !returnFees.length) {
      return 0
    }
    
    const returnFee = returnFees.find(fee => fee.location === 'san-cristobal')
    if (!returnFee) {
      return 0
    }
    
    // Calcular cantidad total de items
    const totalItems = order.rental_items.reduce((total: number, item: any) => total + item.quantity, 0)
    // Multiplicar por cada grupo de 3 items (redondeado hacia arriba)
    const multiplier = Math.ceil(totalItems / 3)
    return returnFee.amount * multiplier
  }
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">{tCommon('loading')}</div>
  }
  
  if (!order) {
    return <div className="flex items-center justify-center h-screen">{t('orderNotFound')}</div>
  }

  // Validación adicional para asegurar que order tenga las propiedades necesarias
  if (!order.total_amount || !order.rental_items) {
    return <div className="flex items-center justify-center h-screen">{tCommon('loading')}</div>
  }
  
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-green-50 p-4 rounded-md text-center">
            <p className="text-green-700 font-medium">{t('orderNumber', {number: order.order_number})}</p>
            <p className="text-sm text-green-600">{t('emailSent', {email: order.customer?.email || 'email'})}</p>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">{t('rentalDetails')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>{t('startDate')}:</strong> {formatDate(order.start_date)} {order.start_time}</p>
                <p><strong>{t('endDate')}:</strong> {formatDate(order.end_date)} {order.end_time}</p>
              </div>
              <div>
                <p><strong>{t('returnIsland')}:</strong> {order.return_island === 'santa-cruz' ? 'Santa Cruz' : 'San Cristóbal'}</p>
                <p><strong>{t('pickupLocation')}:</strong> {
                  order.pickup === 'santa-cruz' 
                    ? t('santaCruzOffice')
                    : order.pickup 
                      ? `${t('santaCruzHotel')} : ${order.pickup}`
                      : t('santaCruzHotel')
                }</p>
                <p><strong>{t('status')}:</strong> {t('confirmed')}</p>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="font-medium mb-2">{t('rentedProducts')}</h3>
            <ul className="space-y-2">
              {order.rental_items.map((item: any) => {
                // console.log('item', item)
                const productName = item.product_config?.product_type === 'wetsuit' 
                  ? `${t(item.product_config?.product_subtype === 'short' ? 'wetsuitShort' : 'wetsuitLong')}`
                  : item.product_config?.product_type === 'snorkel'
                  ? t('snorkel')
                  : item.product_config?.product_type === 'fins'
                  ? t('fins')
                  : t('unknownProduct')
                
                return (
                  <li key={item.id} className="flex justify-between">
                    <span>{productName} x{item.quantity}</span>
                    <span>US${item.subtotal.toFixed(2)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          
          <Separator />
          
          <div>
            <div className="flex justify-between">
              <span>{t('totalRented')}</span>
              <span>US${order.rental_items.reduce((total: number, item: any) => total + (item.unit_price * item.quantity * item.days), 0).toFixed(2)}</span>
            </div>
            {order.pickup && order.pickup !== 'santa-cruz' && (
              <div className="flex justify-between">
                <span>{t('hotelPickupFee')}</span>
                <span>US$5.00</span>
              </div>
            )}
            {order.return_island === 'san-cristobal' && (
              <div className="flex justify-between">
                <span>{t('returnFee')}</span>
                <span>US${calculateReturnFee().toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{t('initialPayment')}</span>
              <span>US${(order.total_amount - (order.tax_amount || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('taxes')}</span>
              <span>US${(order.tax_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold mt-2">
              <span>{t('totalPaid')}</span>
              <span>US${order.total_amount.toFixed(2)}</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              <p>{t('priceFor', {days: order.rental_items[0]?.days || 1})}</p>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-medium text-blue-700 mb-2">{t('pickupInstructions')}</h3>
            <p className="text-sm text-blue-600">
              {t('pickupInstructionsText')}
            </p>
            <p className="text-sm text-blue-600">
              {t('customizeInstructions1')}<br />
              <a href={`https://galapagos.viajes/sizes?orderId=${order.id}`} className="text-blue-600 underline">{`https://galapagos.viajes/sizes?orderId=${order.id}`}</a><br />
              {t('customizeInstructions2')}
            </p>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-center">
          <Button onClick={() => router.push('/')}>{t('backToHome')}</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function ConfirmationPage() {
  const t = useTranslations('common')
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">{t('loading')}</div>}>
      <ConfirmationContent />
    </Suspense>
  )
}