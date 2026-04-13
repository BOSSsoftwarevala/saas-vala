import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // Check if table exists
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_columns', { tablename: 'categories' })
      .catch(() => ({ data: null, error: new Error('RPC failed') }));

    // Get all categories with service role (bypasses RLS)
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .limit(100);

    // Get column names from first row
    const columns = categories && categories.length > 0 ? Object.keys(categories[0]) : [];

    const result = {
      supabaseUrl,
      tableExists: tableError ? false : true,
      tableError: tableError?.message || null,
      categoriesCount: categories?.length || 0,
      columns,
      sampleCategories: categories?.slice(0, 3) || [],
      catError: catError?.message || null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
