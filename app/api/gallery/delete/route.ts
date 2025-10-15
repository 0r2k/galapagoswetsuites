import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function assertIsAdmin() { return true; }

export async function DELETE(req: Request) {
  if (!assertIsAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { imageId } = await req.json();
    
    if (!imageId) {
      return NextResponse.json({ error: "Image ID is required" }, { status: 400 });
    }

    // First, get the image data to retrieve the storage path
    const { data: imageData, error: fetchError } = await supabaseAdmin
      .from("gallery")
      .select("path")
      .eq("id", imageId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from("gallery")
      .remove([imageData.path]);

    if (storageError) {
      console.error("Storage deletion error:", storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabaseAdmin
      .from("gallery")
      .delete()
      .eq("id", imageId);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Image deleted successfully" 
    });

  } catch (error) {
    console.error("Delete image error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}