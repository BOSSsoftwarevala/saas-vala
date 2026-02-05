 /**
  * Code Watermarking & Domain Lock System
  * Adds invisible watermarks to deployed code for tracking
  * Implements domain-based license validation
  */
 
 interface WatermarkData {
   clientId: string;
   licenseKey: string;
   deployedAt: string;
   allowedDomains: string[];
   machineId?: string;
 }
 
 // Generate unique machine fingerprint
 export function generateMachineId(): string {
   const canvas = document.createElement('canvas');
   const ctx = canvas.getContext('2d');
   if (!ctx) return crypto.randomUUID();
   
   ctx.textBaseline = 'top';
   ctx.font = '14px Arial';
   ctx.fillText('SoftwareVala™', 2, 2);
   
   const dataUrl = canvas.toDataURL();
   let hash = 0;
   for (let i = 0; i < dataUrl.length; i++) {
     hash = ((hash << 5) - hash) + dataUrl.charCodeAt(i);
     hash = hash & hash;
   }
   
   return `SV-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
 }
 
 // Encode watermark data into invisible Unicode characters
 export function encodeWatermark(data: WatermarkData): string {
   const json = JSON.stringify(data);
   const binary = json.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');
   
   // Use zero-width characters to hide data
   const zeroWidthChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
   let encoded = '';
   
   for (let i = 0; i < binary.length; i += 2) {
     const index = parseInt(binary.substr(i, 2), 2);
     encoded += zeroWidthChars[index];
   }
   
   return encoded;
 }
 
 // Decode hidden watermark from code
 export function decodeWatermark(encoded: string): WatermarkData | null {
   try {
     const zeroWidthChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
     let binary = '';
     
     for (const char of encoded) {
       const index = zeroWidthChars.indexOf(char);
       if (index >= 0) {
         binary += index.toString(2).padStart(2, '0');
       }
     }
     
     let json = '';
     for (let i = 0; i < binary.length; i += 8) {
       const byte = binary.substr(i, 8);
       if (byte.length === 8) {
         json += String.fromCharCode(parseInt(byte, 2));
       }
     }
     
     return JSON.parse(json);
   } catch {
     return null;
   }
 }
 
 // Inject watermark into source code
 export function injectWatermark(sourceCode: string, watermarkData: WatermarkData): string {
   const watermark = encodeWatermark(watermarkData);
   
   // Create a watermark comment that looks innocent but contains hidden data
   const watermarkComment = `/* SoftwareVala™ Licensed Product */${watermark}/* ${new Date().toISOString().split('T')[0]} */`;
   
   // Also add visible copyright notice
   const copyrightNotice = `
 /**
  * ═══════════════════════════════════════════════════════════════
  *  LICENSED SOFTWARE - SoftwareVala™ Enterprise Edition
  *  License Key: ${watermarkData.licenseKey.substring(0, 8)}...${watermarkData.licenseKey.slice(-4)}
  *  Client ID: ${watermarkData.clientId}
  *  Deployed: ${watermarkData.deployedAt}
  *  Authorized Domains: ${watermarkData.allowedDomains.join(', ')}
  * ═══════════════════════════════════════════════════════════════
  *  ⚠️ UNAUTHORIZED REDISTRIBUTION IS STRICTLY PROHIBITED
  *  This software is protected by digital watermarking technology.
  *  Any attempt to modify, copy, or redistribute will be traced.
  * ═══════════════════════════════════════════════════════════════
  */
 `;
   
   return copyrightNotice + watermarkComment + '\n\n' + sourceCode;
 }
 
 // Domain lock validation script to inject into deployed code
 export function getDomainLockScript(allowedDomains: string[], licenseKey: string): string {
   return `
 (function() {
   'use strict';
   
   const _sv = {
     domains: ${JSON.stringify(allowedDomains)},
     key: '${licenseKey}',
     check: function() {
       const host = window.location.hostname.toLowerCase();
       const valid = this.domains.some(d => {
         if (d.startsWith('*.')) {
           return host.endsWith(d.slice(1)) || host === d.slice(2);
         }
         return host === d.toLowerCase();
       });
       
       if (!valid && host !== 'localhost' && !host.includes('127.0.0.1')) {
         console.error('[SoftwareVala] ❌ Domain not authorized for this license');
         console.error('[SoftwareVala] License: ' + this.key.substring(0, 8) + '...');
         console.error('[SoftwareVala] Current: ' + host);
         console.error('[SoftwareVala] Allowed: ' + this.domains.join(', '));
         
         // Report unauthorized usage
         fetch('https://api.lovable.app/v1/report-violation', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             license: this.key,
             domain: host,
             timestamp: new Date().toISOString(),
             userAgent: navigator.userAgent
           })
         }).catch(() => {});
         
         // Block application
         document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1a2e;color:#fff;font-family:system-ui;flex-direction:column;"><h1 style="color:#ff4757">⛔ License Violation</h1><p style="color:#aaa;max-width:400px;text-align:center">This software is not licensed for use on this domain. Please contact support to update your license.</p><a href="https://lovable.dev/support" style="color:#4ecdc4;margin-top:20px">Contact Support →</a></div>';
         throw new Error('License domain violation');
       }
       
       return valid;
     }
   };
   
   // Check on load
   if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', () => _sv.check());
   } else {
     _sv.check();
   }
   
   // Re-check periodically
   setInterval(() => _sv.check(), 60000);
   
   window.__sv_verified = true;
 })();
 `;
 }
 
 // Generate anti-tampering hash
 export function generateIntegrityHash(code: string): string {
   let hash = 0;
   for (let i = 0; i < code.length; i++) {
     const char = code.charCodeAt(i);
     hash = ((hash << 5) - hash) + char;
     hash = hash & hash;
   }
   return `SV-${Math.abs(hash).toString(36).toUpperCase()}`;
 }