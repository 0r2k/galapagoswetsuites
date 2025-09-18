import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const order = await req.json();

  // TODO: valida los campos y el pago aquí
  const { data, error } = await supabaseAdmin
    .from("rental_orders")
    .insert([order])
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  try {
    const { orderId, sent_email } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("rental_orders")
      .update({ sent_email })
      .eq("id", orderId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}