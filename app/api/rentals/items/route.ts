import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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