import { NextRequest, NextResponse } from 'next/server';
import { sendAutomaticEmails, getOrderDataForEmails } from '@/lib/emailSender';

export async function POST(req: NextRequest) {
  try {
    const { orderId, templateType } = await req.json();
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }
    
    // Obtener datos completos del pedido
    const orderData = await getOrderDataForEmails(orderId);
    
    if (!orderData) {
      return NextResponse.json(
        { error: 'Order not found or incomplete data' },
        { status: 404 }
      );
    }
    
    // Enviar emails automáticos con filtro opcional por tipo de template
    const result = await sendAutomaticEmails(orderData, templateType);
    
    return NextResponse.json({
      message: `Emails sent successfully. Sent: ${result.emailsSent}, Failed: ${result.emailsFailed}`,
      ...result
    });
    
  } catch (error) {
    console.error('Error sending order emails:', error);
    return NextResponse.json(
      { error: 'Failed to send emails', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}