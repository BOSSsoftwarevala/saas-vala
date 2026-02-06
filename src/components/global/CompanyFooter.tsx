import { COMPANY_CONFIG, getWhatsAppLink } from '@/config/companyConfig';
import { Mail, Phone, Globe, Facebook, Instagram, Youtube, MessageCircle } from 'lucide-react';

export function CompanyFooter() {
  return (
    <footer className="border-t border-border/40 bg-card/30 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Brand */}
          <div className="space-y-2">
            <h3 className="font-bold text-lg">{COMPANY_CONFIG.name}</h3>
            <p className="text-sm text-muted-foreground">{COMPANY_CONFIG.tagline}</p>
          </div>
          
          {/* Contact */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Contact</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              {COMPANY_CONFIG.contact.whatsapp.map((wa, i) => (
                <a 
                  key={i}
                  href={`https://wa.me/${wa.number.replace(/[^0-9]/g, '')}`}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Phone className="h-3 w-3" />
                  {wa.number}
                </a>
              ))}
              <a 
                href={`mailto:${COMPANY_CONFIG.contact.email}`}
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Mail className="h-3 w-3" />
                {COMPANY_CONFIG.contact.email}
              </a>
            </div>
          </div>
          
          {/* Websites */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Our Platforms</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <a 
                href={COMPANY_CONFIG.websites.online.url}
                className="flex items-center gap-2 hover:text-primary transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="h-3 w-3" />
                {COMPANY_CONFIG.websites.online.label}
              </a>
              <a 
                href={COMPANY_CONFIG.websites.offline.url}
                className="flex items-center gap-2 hover:text-primary transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="h-3 w-3" />
                {COMPANY_CONFIG.websites.offline.label}
              </a>
            </div>
          </div>
          
          {/* Social */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Follow Us</h4>
            <div className="flex items-center gap-3">
              <a 
                href={COMPANY_CONFIG.social.facebook.url}
                className="p-2 rounded-full bg-muted/50 hover:bg-primary/20 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a 
                href={COMPANY_CONFIG.social.instagram.url}
                className="p-2 rounded-full bg-muted/50 hover:bg-primary/20 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a 
                href={COMPANY_CONFIG.social.youtube.url}
                className="p-2 rounded-full bg-muted/50 hover:bg-primary/20 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Youtube className="h-4 w-4" />
              </a>
              <a 
                href={getWhatsAppLink()}
                className="p-2 rounded-full bg-muted/50 hover:bg-primary/20 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-border/40 mt-4 pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {COMPANY_CONFIG.name} • {COMPANY_CONFIG.tagline} • 7 Days Free Trial on Everything
        </div>
      </div>
    </footer>
  );
}
