import { NextRequest, NextResponse } from 'next/server';
import { getActivePaymentConfig } from '@/lib/paymentConfig';

export async function GET(request: NextRequest) {
  try {
    const activeConfig = await getActivePaymentConfig();
    
    if (!activeConfig) {
      return NextResponse.json(
        { error: 'No hay configuración de pago activa' },
        { status: 404 }
      );
    }

    // Devolver datos necesarios para el cliente (app_code y app_key son públicos)
    return NextResponse.json({
      environment: activeConfig.environment
    });
  } catch (error) {
    console.error('Error obteniendo configuración de pago:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}