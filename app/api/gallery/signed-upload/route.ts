import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {

  const { ext = "webp" } = await req.json();
  const key = `gallery/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabaseAdmin
    .storage
    .from("gallery")
    .createSignedUploadUrl(key, { upsert: true }); // URL para subir con upsert habilitado

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // URL pública para render (lectura pública)
  const { data: pub } = supabaseAdmin.storage.from("gallery").getPublicUrl(key);

  return NextResponse.json({
    path: key,
    token: data?.token,
    publicUrl: pub?.publicUrl
  });
}
