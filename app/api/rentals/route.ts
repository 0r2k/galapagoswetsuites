// app/api/rentals/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,      // ok que sea NEXT_PUBLIC
    process.env.SUPABASE_SERVICE_ROLE_KEY!      // ¡NO exponer al cliente!
  );

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