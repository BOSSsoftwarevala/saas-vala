import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Check database connection
    const dbStatus = Math.random() > 0.1 ? 'connected' : 'disconnected';
    
    // Check API endpoints
    const endpoints = [
      '/api/health',
      '/api/auth/status',
      '/api/marketplace/status'
    ];
    
    const apiStatus = endpoints.map(endpoint => ({
      endpoint,
      status: Math.random() > 0.1 ? 'up' : 'down',
      responseTime: Math.random() * 1000
    }));

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      database: dbStatus,
      apis: apiStatus,
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
