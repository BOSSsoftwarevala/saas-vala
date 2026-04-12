import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createClient();
    
    let query = supabase
      .from('softwares')
      .select(`
        *,
        categories:category_id (
          name,
          slug
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('categories.slug', category);
    }

    if (featured === 'true') {
      query = query.eq('featured', true);
    }

    const { data: softwares, error } = await query;

    if (error) {
      console.error('Error fetching softwares:', error);
      return NextResponse.json(
        { error: 'Failed to fetch softwares' },
        { status: 500 }
      );
    }

    return NextResponse.json({ softwares });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      slug,
      category_id,
      description,
      tagline,
      icon,
      demo_url,
      details_url,
      price,
      currency,
      featured
    } = body;

    if (!name || !slug || !category_id) {
      return NextResponse.json(
        { error: 'Name, slug, and category_id are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    
    const { data: software, error } = await supabase
      .from('softwares')
      .insert([
        {
          name,
          slug,
          category_id,
          description,
          tagline,
          icon,
          demo_url,
          details_url,
          price: price || 5.00,
          currency: currency || 'USD',
          featured: featured || false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating software:', error);
      return NextResponse.json(
        { error: 'Failed to create software' },
        { status: 500 }
      );
    }

    return NextResponse.json({ software }, { status: 201 });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
