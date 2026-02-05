 /**
  * Auto Data Masking System
  * Automatically masks sensitive data (phone numbers, emails, etc.) in UI
  */
 
 export interface MaskingConfig {
   maskEmails: boolean;
   maskPhones: boolean;
   maskNames: boolean;
   maskPartial: boolean; // Show partial data like xxx@gm***.com
   showOnHover: boolean; // Reveal full data on hover
 }
 
 const defaultConfig: MaskingConfig = {
   maskEmails: true,
   maskPhones: true,
   maskNames: false,
   maskPartial: true,
   showOnHover: true,
 };
 
 // Phone number patterns for various countries
 const phonePatterns = [
   /\+?\d{1,4}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,9}/g, // International
   /\b\d{10,12}\b/g, // Simple 10-12 digit
   /\(\d{3}\)\s?\d{3}[-\s]?\d{4}/g, // (xxx) xxx-xxxx
   /\d{3}[-\s]\d{3}[-\s]\d{4}/g, // xxx-xxx-xxxx
 ];
 
 // Email pattern
 const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
 
 // Mask a phone number
 export function maskPhone(phone: string, partial = true): string {
   if (!phone) return phone;
   
   const cleaned = phone.replace(/\D/g, '');
   
   if (partial && cleaned.length >= 6) {
     // Show first 3 and last 2 digits
     const first = cleaned.slice(0, 3);
     const last = cleaned.slice(-2);
     const middle = '*'.repeat(Math.min(cleaned.length - 5, 6));
     return `+${first}${middle}${last}`;
   }
   
   return '📞 ••••••••••';
 }
 
 // Mask an email address
 export function maskEmail(email: string, partial = true): string {
   if (!email || !email.includes('@')) return email;
   
   const [local, domain] = email.split('@');
   const [domainName, ...ext] = domain.split('.');
   
   if (partial) {
     const maskedLocal = local.length > 2 
       ? local[0] + '•'.repeat(Math.min(local.length - 2, 5)) + local.slice(-1)
       : '••';
     const maskedDomain = domainName.length > 2
       ? domainName[0] + '•'.repeat(Math.min(domainName.length - 2, 4)) + domainName.slice(-1)
       : '••';
     return `${maskedLocal}@${maskedDomain}.${ext.join('.')}`;
   }
   
   return '📧 ••••@••••.•••';
 }
 
 // Mask a name
 export function maskName(name: string, partial = true): string {
   if (!name) return name;
   
   const parts = name.trim().split(/\s+/);
   
   if (partial) {
     return parts.map(part => {
       if (part.length <= 1) return part;
       return part[0] + '•'.repeat(Math.min(part.length - 1, 6));
     }).join(' ');
   }
   
   return '👤 ••••••';
 }
 
 // Mask any text containing sensitive data
 export function maskSensitiveData(
   text: string, 
   config: Partial<MaskingConfig> = {}
 ): string {
   const finalConfig = { ...defaultConfig, ...config };
   let result = text;
   
   // Mask emails
   if (finalConfig.maskEmails) {
     result = result.replace(emailPattern, (match) => 
       maskEmail(match, finalConfig.maskPartial)
     );
   }
   
   // Mask phone numbers
   if (finalConfig.maskPhones) {
     phonePatterns.forEach(pattern => {
       result = result.replace(pattern, (match) => {
         // Don't mask very short numbers (might be product codes, etc.)
         if (match.replace(/\D/g, '').length < 7) return match;
         return maskPhone(match, finalConfig.maskPartial);
       });
     });
   }
   
   return result;
 }
 
 // React hook for masked display with hover reveal
 export function useMaskedValue(
   value: string,
   type: 'email' | 'phone' | 'name' | 'auto',
   config: Partial<MaskingConfig> = {}
 ): { masked: string; original: string; showOnHover: boolean } {
   const finalConfig = { ...defaultConfig, ...config };
   
   let masked: string;
   
   switch (type) {
     case 'email':
       masked = maskEmail(value, finalConfig.maskPartial);
       break;
     case 'phone':
       masked = maskPhone(value, finalConfig.maskPartial);
       break;
     case 'name':
       masked = maskName(value, finalConfig.maskPartial);
       break;
     case 'auto':
     default:
       masked = maskSensitiveData(value, finalConfig);
   }
   
   return {
     masked,
     original: value,
     showOnHover: finalConfig.showOnHover,
   };
 }
 
 // Component props interface for masked field
 export interface MaskedFieldProps {
   value: string;
   type: 'email' | 'phone' | 'name' | 'auto';
   className?: string;
   revealOnHover?: boolean;
   revealOnClick?: boolean;
   copyable?: boolean;
 }