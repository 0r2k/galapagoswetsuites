import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM || 'noreply@galapagos.viajes';

export async function POST(req: NextRequest) {
  try {
    // Verificar autorización (opcional: agregar API key o token)
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.CRONJOB_API_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Calcular fecha de hace 3 días
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`Buscando pedidos con end_date = ${threeDaysAgoStr}`);

    // Buscar pedidos completados con end_date de hace 3 días que no han recibido email de reseña
    const { data: eligibleOrders, error } = await supabaseAdmin
      .from('rental_orders')
      .select(`
        id,
        order_number,
        end_date,
        language,
        review_email_sent,
        review_email_sent_at,
        users (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .gt('status', 1) // status > 1 (completados)
      .eq('end_date', threeDaysAgoStr) // end_date exactamente hace 3 días
      .or('review_email_sent.is.null,review_email_sent.eq.false') // Solo pedidos que no han recibido email de reseña
      .not('users', 'is', null); // asegurar que hay usuario asociado

    if (error) {
      console.error('Error fetching eligible orders:', error);
      return NextResponse.json(
        { error: 'Error fetching orders', details: error.message },
        { status: 500 }
      );
    }

    if (!eligibleOrders || eligibleOrders.length === 0) {
      return NextResponse.json({
        message: 'No hay pedidos elegibles para solicitar reseñas',
        ordersProcessed: 0,
        emailsSent: 0,
        emailsFailed: 0
      });
    }

    console.log(`Encontrados ${eligibleOrders.length} pedidos elegibles`);

    let emailsSent = 0;
    let emailsFailed = 0;
    const processedOrders = [];

    // Procesar cada pedido elegible
    for (const order of eligibleOrders) {
      try {
        const user = Array.isArray(order.users) ? order.users[0] : order.users;
        
        if (!user || !user.email) {
          console.warn(`Pedido ${order.id} no tiene email de usuario válido`);
          emailsFailed++;
          continue;
        }

        // Crear URL de reseña
        const reviewUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/${order.language || 'es'}/review?orderId=${order.id}`;
        
        // Datos para el template de email
        const emailData = {
          customerName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          orderNumber: order.order_number,
          reviewUrl: reviewUrl,
          customerEmail: user.email
        };

        // Aquí podrías enviar el email usando tu sistema de templates existente
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Hola ${emailData.customerName},</h2>
            <p>Gracias por tu compra en Galapagos Dive Rental. Queremos saber tu opinión sobre tu experiencia.</p>
            <p>Por favor, da clic en el siguiente enlace para dejar tu reseña:</p>
            <a href="${emailData.reviewUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Dejar Reseña</a>
            <p>Tu número de orden es: ${emailData.orderNumber}</p>
            <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
            <p>Gracias por tu colaboración!</p>
          </div>
        `;

        const { error: emailError } = await resend.emails.send({
          from: FROM,
          to: user.email,
          subject: `Reseña para tu pedido #${order.order_number}`,
          html: emailHtml,
        });
        
        if (emailError) {
          console.error(`Error sending email to ${user.email} for order ${order.id}:`, emailError);
          emailsFailed++;
          continue;
        }

        console.log(`Enviando email de reseña a ${user.email} para pedido ${order.order_number}`);
        console.log(`URL de reseña: ${reviewUrl}`);

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
          emailsFailed++;
        } else {
          emailsSent++;
          processedOrders.push({
            orderId: order.id,
            orderNumber: order.order_number,
            customerEmail: user.email,
            reviewUrl: reviewUrl
          });
        }

      } catch (orderError) {
        console.error(`Error processing order ${order.id}:`, orderError);
        emailsFailed++;
      }
    }

    return NextResponse.json({
      message: `Cronjob completado. Emails enviados: ${emailsSent}, Fallos: ${emailsFailed}`,
      ordersProcessed: eligibleOrders.length,
      emailsSent,
      emailsFailed,
      processedOrders
    });

  } catch (error) {
    console.error('Error in review cronjob:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Método GET para testing/debugging
export async function GET(req: NextRequest) {
  try {
    // Calcular fecha de hace 3 días
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    // Solo mostrar cuántos pedidos serían elegibles (sin enviar emails)
    const { data: eligibleOrders, error } = await supabaseAdmin
      .from('rental_orders')
      .select(`
        id,
        order_number,
        end_date,
        status,
        review_email_sent,
        users (
          email
        )
      `)
      .gt('status', 1)
      .eq('end_date', threeDaysAgoStr)
      .eq('review_email_sent', false)
      .not('users', 'is', null);

    if (error) {
      return NextResponse.json(
        { error: 'Error fetching orders', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Vista previa del cronjob (sin enviar emails)',
      targetDate: threeDaysAgoStr,
      eligibleOrdersCount: eligibleOrders?.length || 0,
      eligibleOrders: eligibleOrders?.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        endDate: order.end_date,
        status: order.status,
        reviewEmailSent: order.review_email_sent,
        hasUser: !!order.users
      })) || []
    });

  } catch (error) {
    console.error('Error in review cronjob preview:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}