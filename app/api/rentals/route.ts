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