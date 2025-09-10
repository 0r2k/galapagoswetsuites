import { NextRequest, NextResponse } from "next/server";
import { updateTemplateConfig } from "@/lib/templates";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { template_type, recipient_emails } = await request.json();
    
    if (!template_type) {
      return NextResponse.json(
        { error: "El tipo de plantilla es requerido" },
        { status: 400 }
      );
    }

    const result = await updateTemplateConfig(
      params.id,
      template_type,
      recipient_emails
    );

    if (!result) {
      return NextResponse.json(
        { error: "No se pudo actualizar la plantilla" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: "Configuración actualizada exitosamente",
      template: result
    });
  } catch (error) {
    console.error("Error updating template config:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}