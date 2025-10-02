import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { orderId, reviewText, reviewStars } = await request.json()

    // Validar parámetros requeridos
    if (!orderId || !reviewText || !reviewStars) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: orderId, reviewText, reviewStars' },
        { status: 400 }
      )
    }

    // Validar que las estrellas estén en el rango correcto
    if (reviewStars < 1 || reviewStars > 5) {
      return NextResponse.json(
        { error: 'Las estrellas deben estar entre 1 y 5' },
        { status: 400 }
      )
    }

    // Verificar que el pedido existe
    const { data: order, error: orderError } = await supabase
      .from('rental_orders')
      .select('id, review_text, review_stars')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Pedido no encontrado' },
        { status: 404 }
      )
    }

    // Verificar si ya existe una reseña para este pedido
    if (order.review_text || order.review_stars) {
      return NextResponse.json(
        { error: 'Ya existe una reseña para este pedido' },
        { status: 409 }
      )
    }

    // Actualizar el pedido con la reseña
    const { data, error } = await supabase
      .from('rental_orders')
      .update({
        review_text: reviewText,
        review_stars: reviewStars,
        review_submitted_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()

    if (error) {
      console.error('Error al guardar la reseña:', error)
      return NextResponse.json(
        { error: 'Error interno del servidor al guardar la reseña' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Reseña guardada exitosamente',
      data: data[0]
    })

  } catch (error) {
    console.error('Error en el endpoint de reseñas:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// Endpoint GET para obtener reseñas de un pedido específico
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro orderId' },
        { status: 400 }
      )
    }

    const { data: order, error } = await supabase
      .from('rental_orders')
      .select('id, review_text, review_stars, review_submitted_at')
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { error: 'Pedido no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        reviewText: order.review_text,
        reviewStars: order.review_stars,
        reviewSubmittedAt: order.review_submitted_at,
        hasReview: !!(order.review_text && order.review_stars)
      }
    })

  } catch (error) {
    console.error('Error al obtener la reseña:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}