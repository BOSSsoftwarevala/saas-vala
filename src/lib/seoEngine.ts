 /**
  * Enterprise AI SEO Engine
  * Focus: India + Africa Markets
  * Low-cost, High-value, Trust-focused
  */
 
 export interface SeoConfig {
   primaryMarket: 'india' | 'africa';
   targetCountries: string[];
   targetCities: string[];
   businessType: string;
   productType: string;
   pricePoint: 'budget' | 'mid' | 'premium';
   language: 'english' | 'hinglish' | 'simple-english';
 }
 
 export interface MetaData {
   title: string;
   description: string;
   keywords: string[];
   ogTitle: string;
   ogDescription: string;
   ogImage?: string;
   schema: object;
   canonical?: string;
 }
 
 export interface KeywordAnalysis {
   keyword: string;
   intent: 'informational' | 'transactional' | 'navigational' | 'commercial';
   competition: 'low' | 'medium' | 'high';
   volume: number;
   cpc: number;
   difficulty: number;
   localRelevance: number;
   recommended: boolean;
 }
 
 // India market focus cities
 export const INDIA_CITIES = [
   'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 
   'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
   'Surat', 'Kanpur', 'Nagpur', 'Indore', 'Thane',
   'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad'
 ];
 
 // Africa market focus cities
 export const AFRICA_CITIES = [
   'Lagos', 'Cairo', 'Johannesburg', 'Nairobi', 'Accra',
   'Cape Town', 'Casablanca', 'Addis Ababa', 'Dar es Salaam', 'Kampala',
   'Abuja', 'Durban', 'Alexandria', 'Khartoum', 'Lusaka'
 ];
 
 // Business categories for auto-detection
 export const BUSINESS_CATEGORIES = [
   'SaaS', 'E-commerce', 'FinTech', 'EdTech', 'HealthTech',
   'Logistics', 'Real Estate', 'Manufacturing', 'Retail', 'Services',
   'Restaurant', 'Hotel', 'Travel', 'Legal', 'Accounting',
   'HR', 'CRM', 'ERP', 'POS', 'Inventory'
 ];
 
 // Low competition, high intent keyword templates
 export const KEYWORD_TEMPLATES = {
   india: [
     '{service} software in {city}',
     'best {product} for small business India',
     'affordable {service} management system',
     '{product} software price India',
     'free {service} software download',
     'online {product} management India',
     '{service} billing software',
     'GST compliant {product} software',
     '{service} app for business',
     'cheap {product} solution India',
   ],
   africa: [
     '{service} software in {city}',
     'best {product} for business Africa',
     'affordable {service} solution Nigeria',
     '{product} software price Kenya',
     'mobile {service} app Africa',
     'online {product} management system',
     '{service} for SME Africa',
     'cloud {product} software',
     'simple {service} solution',
     'low cost {product} Africa',
   ],
 };
 
 // Trust signals for enterprise positioning
 export const TRUST_SIGNALS = [
   'Enterprise-grade security',
   'Pay only when you use',
   'No hidden charges',
   'Bank-level encryption',
   'GDPR compliant',
   'Data privacy guaranteed',
   '24/7 support',
   'Free migration',
   'No vendor lock-in',
   'Trusted by 10,000+ businesses',
 ];
 
 // Generate SEO-optimized meta title
 export function generateMetaTitle(
   pageName: string,
   businessType: string,
   market: 'india' | 'africa',
   city?: string
 ): string {
   const templates = [
     `${pageName} | Best ${businessType} Software ${city ? `in ${city}` : market === 'india' ? 'India' : 'Africa'} | SoftwareVala`,
     `${businessType} ${pageName} - #1 Affordable Solution | SoftwareVala™`,
     `${pageName} Software | ${businessType} for Small Business ${market === 'india' ? 'India' : 'Africa'}`,
     `Free ${pageName} ${businessType} | Enterprise Features, Budget Price`,
   ];
   
   // Select based on page type
   const template = templates[Math.floor(Math.random() * templates.length)];
   
   // Ensure under 60 characters
   if (template.length > 60) {
     return template.substring(0, 57) + '...';
   }
   
   return template;
 }
 
 // Generate SEO-optimized meta description
 export function generateMetaDescription(
   pageName: string,
   businessType: string,
   market: 'india' | 'africa',
   features: string[]
 ): string {
   const trustSignal = TRUST_SIGNALS[Math.floor(Math.random() * TRUST_SIGNALS.length)];
   const topFeatures = features.slice(0, 3).join(', ');
   
   const templates = [
     `${pageName} software for ${businessType}. ${trustSignal}. Features: ${topFeatures}. Starting at ₹499/month. Free trial available.`,
     `Best ${businessType} ${pageName} solution for ${market === 'india' ? 'India' : 'Africa'}. ${trustSignal}. Pay only when you use. Try free today!`,
     `Affordable ${pageName} software with ${topFeatures}. ${trustSignal}. Built for small to enterprise business. Get started free!`,
   ];
   
   const template = templates[Math.floor(Math.random() * templates.length)];
   
   // Ensure under 160 characters
   if (template.length > 160) {
     return template.substring(0, 157) + '...';
   }
   
   return template;
 }
 
 // Generate keywords based on content and market
 export function generateKeywords(
   pageName: string,
   businessType: string,
   market: 'india' | 'africa',
   contentKeywords: string[] = []
 ): string[] {
   const cities = market === 'india' ? INDIA_CITIES.slice(0, 5) : AFRICA_CITIES.slice(0, 5);
   const templates = KEYWORD_TEMPLATES[market];
   
   const keywords: string[] = [];
   
   // Add long-tail keywords with city intent
   cities.forEach(city => {
     keywords.push(`${businessType.toLowerCase()} software in ${city.toLowerCase()}`);
     keywords.push(`best ${pageName.toLowerCase()} ${city.toLowerCase()}`);
   });
   
   // Add template-based keywords
   templates.slice(0, 5).forEach(template => {
     keywords.push(
       template
         .replace('{service}', pageName.toLowerCase())
         .replace('{product}', businessType.toLowerCase())
         .replace('{city}', cities[0])
     );
   });
   
   // Add content-based keywords
   keywords.push(...contentKeywords.slice(0, 10));
   
   // Add low-competition generic keywords
   keywords.push(
     `${businessType.toLowerCase()} software`,
     `free ${pageName.toLowerCase()} app`,
     `online ${businessType.toLowerCase()} solution`,
     `affordable ${pageName.toLowerCase()} software`,
     `${businessType.toLowerCase()} management system`,
     `small business ${pageName.toLowerCase()}`,
   );
   
   // Remove duplicates and return
   return [...new Set(keywords)].slice(0, 25);
 }
 
 // Generate JSON-LD schema markup
 export function generateSchema(
   type: 'SoftwareApplication' | 'Product' | 'Organization' | 'LocalBusiness',
   data: {
     name: string;
     description: string;
     price?: string;
     currency?: string;
     rating?: number;
     reviewCount?: number;
     url?: string;
   }
 ): object {
   const baseSchema = {
     '@context': 'https://schema.org',
     '@type': type,
     name: data.name,
     description: data.description,
     url: data.url || 'https://saasvala.com',
     publisher: {
       '@type': 'Organization',
       name: 'SaaS VALA™',
       logo: {
         '@type': 'ImageObject',
         url: 'https://saasvala.com/favicon.png',
       },
     },
   };
   
   if (type === 'SoftwareApplication') {
     return {
       ...baseSchema,
       applicationCategory: 'BusinessApplication',
       operatingSystem: 'Web, Android, iOS',
       offers: {
         '@type': 'Offer',
         price: data.price || '499',
         priceCurrency: data.currency || 'INR',
         priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
       },
       aggregateRating: data.rating ? {
         '@type': 'AggregateRating',
         ratingValue: data.rating.toString(),
         reviewCount: data.reviewCount?.toString() || '100',
         bestRating: '5',
         worstRating: '1',
       } : undefined,
     };
   }
   
   if (type === 'Product') {
     return {
       ...baseSchema,
       brand: {
         '@type': 'Brand',
         name: 'SoftwareVala™',
       },
       offers: {
         '@type': 'Offer',
         availability: 'https://schema.org/InStock',
         price: data.price || '499',
         priceCurrency: data.currency || 'INR',
       },
     };
   }
   
   return baseSchema;
 }
 
 // Generate sitemap entry
 export function generateSitemapEntry(
   url: string,
   priority: number = 0.8,
   changefreq: 'daily' | 'weekly' | 'monthly' = 'weekly'
 ): string {
   return `
   <url>
     <loc>${url}</loc>
     <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
     <changefreq>${changefreq}</changefreq>
     <priority>${priority.toFixed(1)}</priority>
   </url>`;
 }
 
 // Generate robots.txt content
 export function generateRobotsTxt(
   sitemapUrl: string,
   disallowPaths: string[] = []
 ): string {
   return `# SoftwareVala™ Robots.txt
 # Enterprise SEO Optimized
 
 User-agent: *
 Allow: /
 
 ${disallowPaths.map(path => `Disallow: ${path}`).join('\n')}
 
 # Sitemap
 Sitemap: ${sitemapUrl}
 
 # Crawl-delay for low-bandwidth optimization
 Crawl-delay: 1
 
 # Block AI training bots (optional)
 User-agent: GPTBot
 Disallow: /
 
 User-agent: CCBot
 Disallow: /`;
 }
 
 // Analyze keyword for competition and value
 export function analyzeKeyword(
   keyword: string,
   market: 'india' | 'africa'
 ): KeywordAnalysis {
   // Simulated analysis - in production, use APIs like SEMrush, Ahrefs
   const isLocal = INDIA_CITIES.some(c => keyword.toLowerCase().includes(c.toLowerCase())) ||
                   AFRICA_CITIES.some(c => keyword.toLowerCase().includes(c.toLowerCase()));
   
   const isLongTail = keyword.split(' ').length >= 4;
   const hasIntent = ['buy', 'price', 'best', 'free', 'download', 'online', 'software'].some(
     w => keyword.toLowerCase().includes(w)
   );
   
   // Local + long-tail + intent = LOW competition, HIGH value
   const competition = isLocal && isLongTail ? 'low' : isLongTail ? 'medium' : 'high';
   const difficulty = isLocal ? 20 + Math.random() * 30 : 50 + Math.random() * 40;
   
   return {
     keyword,
     intent: hasIntent ? 'transactional' : isLocal ? 'commercial' : 'informational',
     competition,
     volume: Math.floor(100 + Math.random() * 5000),
     cpc: market === 'india' ? 0.1 + Math.random() * 0.5 : 0.05 + Math.random() * 0.3,
     difficulty: Math.round(difficulty),
     localRelevance: isLocal ? 95 : 60,
     recommended: competition === 'low' && hasIntent,
   };
 }
 
 // Auto-detect business category from content
 export function detectBusinessCategory(content: string): string {
   const lowerContent = content.toLowerCase();
   
   for (const category of BUSINESS_CATEGORIES) {
     if (lowerContent.includes(category.toLowerCase())) {
       return category;
     }
   }
   
   // Check for common business keywords
   if (lowerContent.includes('billing') || lowerContent.includes('invoice')) return 'Accounting';
   if (lowerContent.includes('employee') || lowerContent.includes('payroll')) return 'HR';
   if (lowerContent.includes('customer') || lowerContent.includes('lead')) return 'CRM';
   if (lowerContent.includes('stock') || lowerContent.includes('warehouse')) return 'Inventory';
   if (lowerContent.includes('order') || lowerContent.includes('delivery')) return 'Logistics';
   if (lowerContent.includes('school') || lowerContent.includes('student')) return 'EdTech';
   if (lowerContent.includes('hospital') || lowerContent.includes('patient')) return 'HealthTech';
   if (lowerContent.includes('shop') || lowerContent.includes('store')) return 'Retail';
   if (lowerContent.includes('restaurant') || lowerContent.includes('menu')) return 'Restaurant';
   if (lowerContent.includes('hotel') || lowerContent.includes('booking')) return 'Hotel';
   
   return 'SaaS'; // Default
 }
 
 // Calculate SEO score
 export function calculateSeoScore(meta: Partial<MetaData>): {
   score: number;
   issues: string[];
   suggestions: string[];
 } {
   let score = 0;
   const issues: string[] = [];
   const suggestions: string[] = [];
   
   // Title check (0-20 points)
   if (meta.title) {
     if (meta.title.length >= 30 && meta.title.length <= 60) {
       score += 20;
     } else if (meta.title.length < 30) {
       score += 10;
       issues.push('Title too short (< 30 chars)');
       suggestions.push('Add more descriptive keywords to title');
     } else {
       score += 10;
       issues.push('Title too long (> 60 chars)');
       suggestions.push('Shorten title to under 60 characters');
     }
   } else {
     issues.push('Missing meta title');
     suggestions.push('Add a descriptive title with primary keyword');
   }
   
   // Description check (0-20 points)
   if (meta.description) {
     if (meta.description.length >= 120 && meta.description.length <= 160) {
       score += 20;
     } else if (meta.description.length < 120) {
       score += 10;
       issues.push('Description too short');
       suggestions.push('Expand description with benefits and CTA');
     } else {
       score += 10;
       issues.push('Description too long (> 160 chars)');
       suggestions.push('Shorten description to under 160 characters');
     }
   } else {
     issues.push('Missing meta description');
     suggestions.push('Add a compelling description with keywords');
   }
   
   // Keywords check (0-20 points)
   if (meta.keywords && meta.keywords.length >= 5) {
     score += 20;
   } else if (meta.keywords && meta.keywords.length > 0) {
     score += 10;
     suggestions.push('Add more relevant keywords (aim for 10-15)');
   } else {
     issues.push('No keywords defined');
     suggestions.push('Add relevant long-tail keywords');
   }
   
   // OG tags check (0-20 points)
   if (meta.ogTitle && meta.ogDescription) {
     score += 20;
   } else {
     score += 5;
     issues.push('Missing OG tags');
     suggestions.push('Add Open Graph tags for social sharing');
   }
   
   // Schema check (0-20 points)
   if (meta.schema && Object.keys(meta.schema).length > 0) {
     score += 20;
   } else {
     issues.push('Missing schema markup');
     suggestions.push('Add JSON-LD schema for rich snippets');
   }
   
   return { score, issues, suggestions };
 }