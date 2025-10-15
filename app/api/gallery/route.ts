import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching gallery images:', error)
      return NextResponse.json(
        { error: 'Error al obtener las imágenes de la galería' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      images: data || []
    })
  } catch (error) {
    console.error('Error in gallery API:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, image_url, alt_text, display_order } = body

    if (!title || !image_url) {
      return NextResponse.json(
        { error: 'Título e imagen son requeridos' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('gallery_images')
      .insert([{
        title,
        description,
        image_url,
        alt_text,
        display_order: display_order || 0,
        active: true
      }])
      .select()

    if (error) {
      console.error('Error creating gallery image:', error)
      return NextResponse.json(
        { error: 'Error al crear la imagen en la galería' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      image: data[0]
    })
  } catch (error) {
    console.error('Error in gallery POST API:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, description, image_url, alt_text, display_order, active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('gallery_images')
      .update({
        title,
        description,
        image_url,
        alt_text,
        display_order,
        active
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error updating gallery image:', error)
      return NextResponse.json(
        { error: 'Error al actualizar la imagen' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      image: data[0]
    })
  } catch (error) {
    console.error('Error in gallery PUT API:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('gallery_images')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting gallery image:', error)
      return NextResponse.json(
        { error: 'Error al eliminar la imagen' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Imagen eliminada correctamente'
    })
  } catch (error) {
    console.error('Error in gallery DELETE API:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}