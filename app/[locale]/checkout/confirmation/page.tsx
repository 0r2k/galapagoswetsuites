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
        
        const rentalItemsData = await fetch('/api/rentals/items?order_id=' + orderId)
        if (!rentalItemsData.ok) {
          throw new Error('Failed to fetch rental items')
        }
        const items = await rentalItemsData.json()

        const customerData = await fetch('/api/customer/' + orderData.customer_id)
        if (!customerData.ok) {
          throw new Error('Failed to fetch customer')
        }
        const customer = await customerData.json()
        
        setOrder({
          ...orderData,
          rental_items: items || [],
          customer: customer
        })
        
        // Enviar emails automáticos después de cargar el pedido
        if (!orderData.sent_email) {
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
              // Actualizar sent_email a true después de enviar correctamente
              const updateResponse = await fetch('/api/rentals', {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderId, sent_email: true })
              })
               
              if (updateResponse.ok) {
                console.log('Campo sent_email actualizado a true')
              } else {
                const updateError = await updateResponse.json()
                console.error('Error actualizando sent_email:', updateError)
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
                    <span>${item.subtotal.toFixed(2)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          
          <Separator />
          
          <div>
            <div className="flex justify-between">
              <span>{t('totalRented')}</span>
              <span>${order.rental_items.reduce((total: number, item: any) => total + (item.unit_price * item.quantity * item.days), 0).toFixed(2)}</span>
            </div>
            {order.return_island === 'san-cristobal' && (
              <div className="flex justify-between">
                <span>{t('returnFee')}</span>
                <span>${calculateReturnFee().toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{t('initialPayment')}</span>
              <span>${(order.total_amount - order.tax_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('taxes')}</span>
              <span>${order.tax_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold mt-2">
              <span>{t('totalPaid')}</span>
              <span>${order.total_amount.toFixed(2)}</span>
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