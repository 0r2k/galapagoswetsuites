import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM || 'noreply@galapagos.viajes';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }
    
    // Obtener información del pedido y cliente
    const { data: order, error: orderError } = await supabaseAdmin
      .from('rental_orders')
      .select(`
        id,
        order_number,
        users (
          first_name,
          last_name,
          email
        ),
        rental_items (
          id,
          product_config_id,
          quantity,
          size,
          days,
          unit_price,
          subtotal,
          product_config (
            name,
            name_en,
            product_type,
            product_subtype
          )
        )
      `)
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    const user = Array.isArray(order.users) ? order.users[0] : order.users;
    const customerName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    const customerEmail = user?.email || 'No disponible';
    
    // Crear el HTML del email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Selección de Tallas Completada</h2>
        
        <p>Estimado proveedor,</p>
        
        <p>El cliente <strong>${customerName}</strong> ha completado la selección de tallas para el pedido <strong>#${order.order_number}</strong>.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Información del Cliente:</h3>
          <p><strong>Nombre:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
          <p><strong>Pedido:</strong> #${order.order_number}</p>
        </div>
        
        <p>Puedes revisar las tallas seleccionadas en el siguiente enlace:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://galapagos.viajes/sizes?orderId=${order.id}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: block; font-weight: bold;">
            Ver Tallas Seleccionadas
          </a><br>
          <small>https://galapagos.viajes/sizes?orderId=${order.id}</small>
        </div>
        
        <p>Por favor, proceder con la preparación del pedido según las tallas especificadas.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="color: #6b7280; font-size: 14px;">
          Este es un email automático del sistema de alquiler de equipos de buceo de Chokotrip.
        </p>
      </div>
    `;
    
    // Enviar el email al proveedor
    const { error: emailError } = await resend.emails.send({
      from: FROM,
      to: 'cecheverria@gmail.com', // Cambiar por el email real del proveedor
      subject: `Tallas seleccionadas - Pedido #${order.order_number}`,
      html: emailHtml,
    });
    
    if (emailError) {
      console.error('Error sending supplier notification:', emailError);
      return NextResponse.json(
        { error: 'Failed to send email to supplier' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Supplier notification sent successfully'
    });
    
  } catch (error) {
    console.error('Error in supplier notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}