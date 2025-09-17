import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('order_id')

    if (!orderId) {
      return NextResponse.json({ error: 'ID de pedido requerido' }, { status: 400 })
    }
    // TODO: valida los campos y el pago aquí
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', orderId)
      .single()

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get rental order' }, { status: 500 });
  }
}