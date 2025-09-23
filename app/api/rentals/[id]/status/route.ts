import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = await req.json();
    
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    if (typeof status !== 'number') {
      return NextResponse.json({ error: 'Status incorrecto' }, { status: 400 })
    }

    // Actualizar el status del pedido
    const { data, error } = await supabaseAdmin
      .from("rental_orders")
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      message: 'Status actualizado correctamente',
      data 
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}