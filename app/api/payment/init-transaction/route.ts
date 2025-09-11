import { NextRequest, NextResponse } from 'next/server';
import { getActivePaymentConfig } from '@/lib/paymentConfig';
import generateAuthToken from '@/lib/generateAuthToken';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderData, user } = body;

    // Validar datos requeridos
    if (!orderData || !user) {
      return NextResponse.json(
        { error: 'Datos de orden y usuario son requeridos' },
        { status: 400 }
      );
    }

    // Obtener configuración activa
    const activeConfig = await getActivePaymentConfig();
    
    if (!activeConfig) {
      return NextResponse.json(
        { error: 'No hay configuración de pago activa' },
        { status: 404 }
      );
    }

    // Generar token de autenticación
    const authToken = await generateAuthToken();
    
    // Construir URL de API
    const apiUrl = `${activeConfig.api_url}/v2/transaction/init_reference/`;

    // Preparar datos para Paymentez
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Auth-Token": authToken,
      },
      body: JSON.stringify({
        locale: "es",
        order: orderData,
        user: user,
        conf: {
          style_version: "2",
        }
      })
    };

    // Realizar petición a Paymentez
    const response = await fetch(apiUrl, requestOptions);
    const data = await response.json();

    if (!response.ok) {
      console.error('Error de Paymentez:', data);
      return NextResponse.json(
        { error: 'Error al inicializar transacción con Paymentez' },
        { status: response.status }
      );
    }

    // Solo devolver la referencia
    return NextResponse.json({
      reference: data.reference
    });

  } catch (error) {
    console.error('Error inicializando transacción:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}