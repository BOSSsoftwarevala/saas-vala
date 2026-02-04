import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendOTPRequest {
  invoiceId: string;
  email: string;
  invoiceNumber: string;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { invoiceId, email, invoiceNumber }: SendOTPRequest = await req.json();

    console.log(`Sending OTP for invoice ${invoiceNumber} to ${email}`);

    // Validate required fields
    if (!invoiceId || !email || !invoiceNumber) {
      throw new Error("Missing required fields: invoiceId, email, invoiceNumber");
    }

    // Generate 6-digit OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete any existing OTP for this invoice/email
    await supabase
      .from("invoice_otp_codes")
      .delete()
      .eq("invoice_id", invoiceId)
      .eq("email", email);

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("invoice_otp_codes")
      .insert({
        invoice_id: invoiceId,
        email: email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        verified: false,
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      throw new Error("Failed to store OTP code");
    }

    console.log(`OTP ${otpCode} stored for invoice ${invoiceId}`);

    // Send email with OTP
    const emailResponse = await resend.emails.send({
      from: "SoftwareVala <noreply@resend.dev>",
      to: [email],
      subject: `Your OTP for Invoice ${invoiceNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #18181b; font-size: 24px; margin: 0;">Invoice Signature Verification</h1>
              <p style="color: #71717a; font-size: 14px; margin-top: 8px;">Invoice: ${invoiceNumber}</p>
            </div>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Use the following OTP code to verify your identity and sign the invoice:
            </p>
            
            <div style="background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #ffffff;">${otpCode}</span>
            </div>
            
            <p style="color: #71717a; font-size: 14px; text-align: center; margin-bottom: 24px;">
              This code expires in <strong>10 minutes</strong>.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
              If you didn't request this code, please ignore this email.<br>
              Powered by <strong style="color: #f97316;">SoftwareVala™</strong>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `OTP sent to ${email}`,
        // Don't send OTP in response for security, but useful for testing
        // otp: otpCode 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invoice-otp function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
