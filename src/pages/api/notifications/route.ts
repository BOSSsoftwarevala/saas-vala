import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { softwareId, email } = body;

    if (!softwareId || !email) {
      return NextResponse.json(
        { error: 'Software ID and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    
    const { data: notification, error } = await supabase
      .from('software_notifications')
      .insert([
        {
          software_id: softwareId,
          email: email,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate entry
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'You are already notified for this software' },
          { status: 409 }
        );
      }
      
      console.error('Error creating notification:', error);
      return NextResponse.json(
        { error: 'Failed to create notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const softwareId = searchParams.get('softwareId');

    const supabase = createClient();
    
    let query = supabase
      .from('software_notifications')
      .select(`
        *,
        softwares:software_id (
          name,
          slug,
          icon
        )
      `)
      .order('created_at', { ascending: false });

    if (email) {
      query = query.eq('email', email);
    }

    if (softwareId) {
      query = query.eq('software_id', softwareId);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
