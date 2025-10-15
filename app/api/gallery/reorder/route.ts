import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function assertIsAdmin() { return true; }

export async function POST(req: Request) {
  if (!assertIsAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { images } = await req.json();
    
    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ error: "Images array is required" }, { status: 400 });
    }

    // Validate that all images have id and sort_order
    for (const img of images) {
      if (!img.id || typeof img.sort_order !== 'number') {
        return NextResponse.json({ 
          error: "Each image must have id and sort_order" 
        }, { status: 400 });
      }
    }

    // Update sort_order for each image
    const updatePromises = images.map(img => 
      supabaseAdmin
        .from("gallery")
        .update({ sort_order: img.sort_order })
        .eq("id", img.id)
    );

    const results = await Promise.all(updatePromises);

    // Check if any updates failed
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error("Some updates failed:", errors);
      return NextResponse.json({ 
        error: "Some images failed to update" 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Images reordered successfully",
      updated: images.length
    });

  } catch (error) {
    console.error("Reorder images error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}