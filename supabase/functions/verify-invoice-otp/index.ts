import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyOTPRequest {
  invoiceId: string;
  email: string;
  otpCode: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { invoiceId, email, otpCode }: VerifyOTPRequest = await req.json();

    console.log(`Verifying OTP for invoice ${invoiceId}, email ${email}`);

    // Validate required fields
    if (!invoiceId || !email || !otpCode) {
      throw new Error("Missing required fields: invoiceId, email, otpCode");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from("invoice_otp_codes")
      .select("*")
      .eq("invoice_id", invoiceId)
      .eq("email", email)
      .eq("otp_code", otpCode)
      .eq("verified", false)
      .single();

    if (fetchError || !otpRecord) {
      console.log("OTP not found or already verified");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid OTP code" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if OTP has expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (expiresAt < new Date()) {
      console.log("OTP has expired");
      // Delete expired OTP
      await supabase
        .from("invoice_otp_codes")
        .delete()
        .eq("id", otpRecord.id);

      return new Response(
        JSON.stringify({ success: false, error: "OTP has expired. Please request a new one." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark OTP as verified
    const { error: updateError } = await supabase
      .from("invoice_otp_codes")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    if (updateError) {
      console.error("Error updating OTP:", updateError);
      throw new Error("Failed to verify OTP");
    }

    // Update invoice to mark OTP as verified
    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({
        otp_verified: true,
        otp_verified_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (invoiceError) {
      console.error("Error updating invoice:", invoiceError);
    }

    console.log("OTP verified successfully");

    return new Response(
      JSON.stringify({ success: true, message: "OTP verified successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-invoice-otp function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
