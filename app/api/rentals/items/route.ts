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
      .from('rental_items')
      .select(`
        *,
        product_config (
            id,
          booking_mode,
            product_type,
            product_subtype,
            size,
            public_price,
            supplier_cost
        )
      `)
      .eq('order_id', orderId)

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get rental order' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const items = await req.json();

  // TODO: valida los campos y el pago aquí
  const { data, error } = await supabaseAdmin
    .from("rental_items")
    .insert(items)
    .select();

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}
