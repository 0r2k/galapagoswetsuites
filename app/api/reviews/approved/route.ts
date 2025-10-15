import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('rental_orders')
      .select(`
        id,
        review_text,
        review_stars,
        review_submitted_at,
        users (
          first_name,
          last_name,
          nationality
        )
      `)
      .not('review_text', 'is', null)
      .not('review_submitted_at', 'is', null)
      .eq('review_approved', true)
      .order('review_submitted_at', { ascending: false })
      .limit(20); // Limitar a 20 reviews más recientes

    if (error) {
      console.error('Error fetching approved reviews:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Formatear los datos para el frontend
    const formattedReviews = data?.map(order => {
      const user = Array.isArray(order.users) ? order.users[0] : order.users;
      const firstName = user?.first_name || 'Cliente';
      const lastName = user?.last_name || '';
      const nationality = user?.nationality || null;
      const lastInitial = lastName ? lastName.charAt(0).toUpperCase() + '.' : '';
      
      return {
        id: order.id,
        customerName: `${firstName} ${lastInitial}`.trim(),
        reviewText: order.review_text,
        reviewStars: order.review_stars,
        reviewDate: order.review_submitted_at,
        nationality: nationality
      };
    }) || [];

    return NextResponse.json(formattedReviews);
  } catch (error) {
    console.error('Error in approved reviews API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}