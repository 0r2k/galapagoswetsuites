import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Obtener el pedido con sus items y productos relacionados
    const { data, error } = await supabaseAdmin
      .from("rental_orders")
      .select(`
        id,
        customer_id,
        users (
          first_name,
          last_name,
          email
        ),
        rental_items (
          id,
          product_config_id,
          quantity,
          size,
          product_config (
            name,
            name_en,
            product_type,
            product_subtype
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get rental order' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { sizes } = body; // { "itemId-0": size, "itemId-1": size2, ... }
    
    if (!id || !sizes) {
      return NextResponse.json({ error: 'ID y tallas requeridos' }, { status: 400 })
    }

    // Agrupar las tallas por item original
    const itemSizes: Record<string, string[]> = {};
    
    Object.entries(sizes).forEach(([uniqueId, size]) => {
      const [itemId, index] = uniqueId.split('|');
      if (!itemSizes[itemId]) {
        itemSizes[itemId] = [];
      }
      itemSizes[itemId][parseInt(index)] = size as string;
    });

    // Actualizar cada item con un array de tallas
    const updates = Object.entries(itemSizes).map(([itemId, sizesArray]) => 
      supabaseAdmin
        .from('rental_items')
        .update({ size: sizesArray.join(',') }) // Guardar como string separado por comas
        .eq('id', itemId)
    );

    const results = await Promise.all(updates);
    
    // Verificar si hubo errores
    const hasErrors = results.some(result => result.error);
    if (hasErrors) {
      const errors = results.filter(result => result.error).map(result => result.error);
      return NextResponse.json({ error: 'Error al actualizar algunas tallas', details: errors }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Tallas actualizadas correctamente' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update sizes' }, { status: 500 });
  }
}