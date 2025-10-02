'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabaseClient'
import { Star, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface OrderData {
  id: string
  order_number: number
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  return_island: string
  total_amount: number
  review_text?: string
  review_stars?: number
  review_submitted_at?: string
  users: {
    first_name: string
    last_name: string
    email: string
  } | {
    first_name: string
    last_name: string
    email: string
  }[]
  rental_items: Array<{
    id: string
    quantity: number
    size: string
    days: number
    unit_price: number
    subtotal: number
    product_config: {
      name: string
      name_en: string
      product_type: string
      product_subtype: string
    } | {
      name: string
      name_en: string
      product_type: string
      product_subtype: string
    }[]
  }>
}

function ReviewPageContent() {
  const searchParams = useSearchParams()
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('review')
  const locale = params.locale as string || 'es'
  
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [reviewText, setReviewText] = useState('')
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)

  const orderId = searchParams.get('orderId')

  useEffect(() => {
    if (!orderId) {
      setError('ID de pedido no proporcionado')
      setLoading(false)
      return
    }

    fetchOrderData()
  }, [orderId])

  const fetchOrderData = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('rental_orders')
        .select(`
          id,
          order_number,
          start_date,
          end_date,
          start_time,
          end_time,
          return_island,
          total_amount,
          review_text,
          review_stars,
          review_submitted_at,
          users (
            first_name,
            last_name,
            email
          ),
          rental_items (
            id,
            quantity,
            size,
            days,
            unit_price,
            subtotal,
            product_config (
              name,
              name_en,
              product_type,
              product_subtype
            )
          )
        `)
        .eq('id', orderId)
        .single()

      if (error) {
        throw error
      }

      if (!data) {
        setError('Pedido no encontrado')
        return
      }

      setOrderData(data)
      
      // Si ya hay una reseña, mostrar los datos existentes
      if (data.review_text) {
        setReviewText(data.review_text)
        setRating(data.review_stars || 0)
        setSuccess(true)
      }

    } catch (err) {
      console.error('Error fetching order:', err)
      setError('Error al cargar los datos del pedido')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!orderData || !reviewText.trim() || rating === 0) {
      setError('Por favor completa todos los campos')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderData.id,
          reviewText: reviewText.trim(),
          reviewStars: rating
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar la reseña')
      }

      setSuccess(true)
      
    } catch (err) {
      console.error('Error submitting review:', err)
      setError(err instanceof Error ? err.message : 'Error al enviar la reseña')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5) // HH:MM
  }

  const getProductName = (item: OrderData['rental_items'][0]) => {
    const productConfig = Array.isArray(item.product_config) 
      ? item.product_config[0] 
      : item.product_config;
    return locale === 'en' && productConfig?.name_en 
      ? productConfig.name_en 
      : productConfig?.name
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando datos del pedido...</p>
        </div>
      </div>
    )
  }

  if (error && !orderData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => router.push('/')}>
                Volver al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!orderData) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center gap-2">
            <Image src="/favicon.webp" alt="Chokotrip" width={40} height={40} />
            <p className="text-md sm:text-xl font-bold">Galápagos - Wetsuit & Snorkeling</p>
          </div>
          <h2 className="text-xl text-gray-600">
            {success ? '¡Gracias por tu reseña!' : '¿Cómo fue tu experiencia?'}
          </h2>
        </div>

        {success && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center text-green-700">
                <CheckCircle className="h-6 w-6 mr-2" />
                <span className="font-medium">
                  {orderData.review_submitted_at 
                    ? 'Tu reseña ya fue enviada anteriormente' 
                    : '¡Tu reseña ha sido enviada exitosamente!'
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              📋 Resumen de tu Alquiler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Número de Orden</p>
                <p className="font-semibold text-blue-600">#{orderData.order_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Cliente</p>
                <p className="font-semibold">
                  {Array.isArray(orderData.users) 
                    ? `${orderData.users[0]?.first_name} ${orderData.users[0]?.last_name}`
                    : `${orderData.users.first_name} ${orderData.users.last_name}`
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Período de Alquiler</p>
                <p className="font-semibold">
                  {formatDate(orderData.start_date)} {formatTime(orderData.start_time)} - {formatDate(orderData.end_date)} {formatTime(orderData.end_time)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Isla de Devolución</p>
                <p className="font-semibold">{orderData.return_island}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <h4 className="font-semibold mb-3">Equipos Alquilados:</h4>
              <div className="space-y-2">
                {orderData.rental_items.map((item) => {
                  const productConfig = Array.isArray(item.product_config) 
                    ? item.product_config[0] 
                    : item.product_config;
                  
                  return (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">
                          {locale === 'en' && productConfig?.name_en 
                            ? productConfig.name_en 
                            : productConfig?.name
                          }
                        </p>
                        <p className="text-sm text-gray-600">
                          Talla: {item.size} • Cantidad: {item.quantity} • {item.days} días
                        </p>
                      </div>
                      <Badge variant="secondary">
                        ${item.subtotal.toFixed(2)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-3 border-t">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-lg">${orderData.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Form */}
        {!success && (
          <Card>
            <CardHeader>
              <CardTitle>⭐ Deja tu Reseña</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                
                {/* Star Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calificación (1-5 estrellas)
                  </label>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="p-1 transition-colors"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            star <= (hoveredRating || rating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      {rating === 1 && 'Muy malo'}
                      {rating === 2 && 'Malo'}
                      {rating === 3 && 'Regular'}
                      {rating === 4 && 'Bueno'}
                      {rating === 5 && 'Excelente'}
                    </p>
                  )}
                </div>

                {/* Review Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cuéntanos sobre tu experiencia
                  </label>
                  <Textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Describe tu experiencia con nuestro servicio de alquiler de equipos de buceo..."
                    rows={5}
                    className="w-full"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {reviewText.length}/500 caracteres
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  onClick={handleSubmitReview}
                  disabled={submitting || !reviewText.trim() || rating === 0}
                  className="w-full"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Enviando reseña...
                    </>
                  ) : (
                    'Enviar Reseña'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Review Display */}
        {success && orderData.review_text && (
          <Card>
            <CardHeader>
              <CardTitle>Tu Reseña</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= (orderData.review_stars || 0)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-sm text-gray-600">
                    ({orderData.review_stars}/5 estrellas)
                  </span>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-800">{orderData.review_text}</p>
                </div>
                
                {orderData.review_submitted_at && (
                  <p className="text-sm text-gray-500">
                    Enviado el {formatDate(orderData.review_submitted_at)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 pt-6 border-t">
          <p className="text-gray-600 mb-2">
            ¡Gracias por elegir Galápagos Dive Rental!
          </p>
          <Button variant="outline" onClick={() => router.push('/')}>
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando...</p>
        </div>
      </div>
    }>
      <ReviewPageContent />
    </Suspense>
  )
}