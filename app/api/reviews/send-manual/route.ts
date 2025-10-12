import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

    // Buscar el pedido específico con validaciones
    const { data: order, error } = await supabaseAdmin
      .from('rental_orders')
      .select(`
        id,
        order_number,
        end_date,
        language,
        status,
        review_email_sent,
        review_email_sent_at,
        review_submitted_at,
        users (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const user = Array.isArray(order.users) ? order.users[0] : order.users;
    
    if (!user || !user.email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // Validaciones según los criterios especificados
    if (order.status < 2) {
      return NextResponse.json(
        { error: 'Order status must be >= 2 (completed)' },
        { status: 400 }
      );
    }

    // Verificar si ya existe una reseña
    if (order.review_submitted_at) {
      return NextResponse.json(
        { error: 'Review already submitted for this order' },
        { status: 400 }
      );
    }

    // Verificar que el end_date sea al menos 3 días atrás
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const orderEndDate = new Date(order.end_date);
    
    if (orderEndDate > threeDaysAgo) {
      return NextResponse.json(
        { error: 'Order end date must be at least 3 days ago' },
        { status: 400 }
      );
    }

    // Crear URL de reseña
    const reviewUrl = `https://galapagos.viajes/${order.language || 'es'}/review?orderId=${order.id}`;
    
    // Datos para el template de email
    const emailData = {
      customerName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      orderNumber: order.order_number,
      reviewUrl: reviewUrl,
      customerEmail: user.email
    };

    // Determinar el idioma del email
    const isEnglish = order.language === 'en';
    
    // Contenido del email según el idioma
    const emailContent = isEnglish ? {
      subject: `Review for your order #${order.order_number}`,
      greeting: `Hello ${emailData.customerName},`,
      thankYou: `Thank you for your purchase at Galápagos Viajes by ChokoTrip. We would like to know your opinion about your experience.`,
      instruction: `Please click on the following link to leave your review:`,
      buttonText: `Leave Review`,
      orderInfo: `Your order number is: ${emailData.orderNumber}`,
      contact: `If you have any questions, don't hesitate to contact us.`,
      closing: `Thank you for your collaboration!`
    } : {
      subject: `Reseña para tu pedido #${order.order_number}`,
      greeting: `Hola ${emailData.customerName},`,
      thankYou: `Gracias por tu compra en Galápagos Viajes by ChokoTrip. Queremos saber tu opinión sobre tu experiencia.`,
      instruction: `Por favor, da clic en el siguiente enlace para dejar tu reseña:`,
      buttonText: `Dejar Reseña`,
      orderInfo: `Tu número de orden es: ${emailData.orderNumber}`,
      contact: `Si tienes alguna pregunta, no dudes en contactarnos.`,
      closing: `Gracias por tu colaboración!`
    };

    // HTML del email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">${emailContent.greeting}</h2>
        <p>${emailContent.thankYou}</p>
        <p>${emailContent.instruction}</p>
        <a href="${emailData.reviewUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">${emailContent.buttonText}</a>
        <p>${emailContent.orderInfo}</p>
        <p>${emailContent.contact}</p>
        <p>${emailContent.closing}</p>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: FROM,
      to: user.email,
      subject: emailContent.subject,
      html: emailHtml,
    });
    
    if (emailError) {
      console.error(`Error sending email to ${user.email} for order ${order.id}:`, emailError);
      return NextResponse.json(
        { error: 'Failed to send email', details: emailError },
        { status: 500 }
      );
    }

    // Marcar como enviado el email de reseña
    const { error: updateError } = await supabaseAdmin
      .from('rental_orders')
      .update({ 
        review_email_sent: true,
        review_email_sent_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      console.error(`Error updating order ${order.id}:`, updateError);
      return NextResponse.json(
        { error: 'Email sent but failed to update order status', details: updateError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Review email sent successfully',
      orderId: order.id,
      orderNumber: order.order_number,
      customerEmail: user.email,
      reviewUrl: reviewUrl
    });

  } catch (error) {
    console.error('Error in manual review email:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}