# Public Marketplace Implementation Guide

## Overview
A complete, production-ready public marketplace system for software/APK distribution with secure payments, licensing, reseller integration, and high-performance UI.

## Architecture
```
Frontend UI (React/TypeScript)
    ↓
API Gateway Layer (src/lib/api.ts)
    ↓
Hooks & State Management (src/hooks/useMarketplace.ts)
    ↓
Supabase Backend (Database + RLS + Auth)
    ↓
Payment Gateways (UPI, Wise, PayU, Binance)
```

## Database Schema

### Core Tables
- **products**: Base software products
- **product_pricing**: Pricing for different durations (30/90/180/365 days)
- **orders**: Customer purchase orders
- **transactions**: Payment transactions with audit trail
- **payment_gateways**: Gateway configurations
- **payment_logs**: Payment request/response logging

### User Management
- **wallets**: User balance tracking
- **wallet_transactions**: Balance history
- **user_favorites**: Favorite products per user
- **license_keys**: Generated license keys
- **license_activations**: Device binding for keys

### Ratings & Reviews
- **product_ratings**: User ratings and reviews
- **demo_access_logs**: Demo session tracking

### Reseller System
- **resellers**: Reseller accounts
- **reseller_plans**: Plan offerings
- **reseller_plan_subscriptions**: Active plan subscriptions
- **reseller_earnings**: Commission tracking
- **reseller_product_pricing**: Custom pricing per reseller

### Marketing & Notifications
- **marketplace_banners**: Promotional banners
- **notifications**: User notifications
- **email_logs**: Email delivery tracking

## API Endpoints (60+)

### public Marketplace API Object

#### Products
```typescript
publicMarketplaceApi.listProducts({category, search, sort, limit, offset})
publicMarketplaceApi.getProduct(id)
publicMarketplaceApi.getProductPricing(id)
```

#### Payments
```typescript
publicMarketplaceApi.initiatePayment({product_id, duration_days, payment_method, amount})
publicMarketplaceApi.verifyPayment({order_id, transaction_ref, provider})
publicMarketplaceApi.getPaymentGateways()
```

#### Licenses
```typescript
publicMarketplaceApi.getLicenseKeys()
publicMarketplaceApi.validateLicense(licenseKey, deviceId)
publicMarketplaceApi.downloadAPK(productId, licenseKeyId)
```

#### Wallet
```typescript
publicMarketplaceApi.getWallet()
publicMarketplaceApi.addWalletBalance(amount, paymentMethod)
```

#### Favorites
```typescript
publicMarketplaceApi.getFavorites()
publicMarketplaceApi.addFavorite(productId)
publicMarketplaceApi.removeFavorite(productId)
```

#### Orders
```typescript
publicMarketplaceApi.getOrders({page, limit, status})
publicMarketplaceApi.getOrder(id)
```

#### Reseller
```typescript
publicMarketplaceApi.getResellerStats()
publicMarketplaceApi.getResellerPlans()
publicMarketplaceApi.subscribeToResellerPlan(planId)
publicMarketplaceApi.generateResellerKeys(productId, quantity, durationDays)
publicMarketplaceApi.getResellerEarnings({period})
```

## React Hooks

### useMarketplaceProducts()
```typescript
const { products, loading, error, fetchProducts } = useMarketplaceProducts();

// Fetch with filters
await fetchProducts({
  category: 'healthcare',
  search: 'hospital',
  sort: 'newest',
  limit: 20,
  page: 1
});
```

### useProductRatings(productId)
```typescript
const { 
  ratings, 
  averageRating, 
  totalRatings, 
  submitRating, 
  fetchRatings 
} = useProductRatings(productId);

// Submit a rating
await submitRating(5, 'Great product!', 'Works perfectly...');
```

### useFavorites()
```typescript
const { 
  favorites, 
  toggleFavorite, 
  isFavorited, 
  fetchFavorites 
} = useFavorites();

// Check if product is favorited
if (isFavorited(productId)) { ... }

// Toggle favorite
await toggleFavorite(productId);
```

### useMarketplacePayment()
```typescript
const { processing, initiatePayment, verifyPayment } = useMarketplacePayment();

// Start payment
const result = await initiatePayment(productId, 30, 'wallet', 9.99);

// Verify payment
const verified = await verifyPayment(orderId, transactionRef, 'upi');
```

### useWallet()
```typescript
const { balance, addBalance, fetchWallet } = useWallet();

// Fetch current balance
await fetchWallet();

// Add funds
await addBalance(50, 'upi');
```

### useMarketplaceOrders()
```typescript
const { orders, loading, fetchOrders } = useMarketplaceOrders();

// Get orders
await fetchOrders({ page: 1, status: 'completed' });
```

### useLicenseKeys()
```typescript
const { licenses, validateLicense, fetchLicenses } = useLicenseKeys();

// Validate a license
const valid = await validateLicense('KEY123...', 'device-id-123');
```

### useResellerMarketplace()
```typescript
const { 
  stats, 
  plans, 
  earnings,
  subscribeToPlan,
  generateKeys 
} = useResellerMarketplace();

// Generate keys for resale
const result = await generateKeys(productId, 100, 30);

// Get earnings
await fetchEarnings('month');
```

## Pages

### /marketplace
Main public marketplace - shows featured products and categories.

### /marketplace/product/:id
Product detail page with:
- Product information
- Ratings and reviews
- Pricing options (1/3/6/12 months)
- Purchase dialog
- Demo access
- License key display after purchase

### /orders
User order history with:
- Order list with filtering
- Order details modal
- Download links
- License key management

### /favorites
User favorites page with:
- Favorited products grid
- Quick actions
- Remove from favorites

## Payment Flow

### 1. Wallet Payment
```
User logs in → Select product → Choose duration → Pay from wallet
→ Verify payment → Generate license key → Send email → Download APK
```

### 2. UPI Payment
```
User selects UPI → Sees UPI ID → Makes payment manually → 
Enters transaction ID → Payment pending admin approval → 
License key generated after approval
```

### 3. Bank Transfer
```
User selects Bank → Shows bank details → Makes transfer →
Enters transaction reference → Payment pending → 
License key generated after approval
```

### 4. Third-party Gateway (Wise, PayU, Binance)
```
Initiate payment → Redirect to gateway → Callback confirmation →
Verify with webhook → Generate license key → Download enabled
```

## License Key System

### Key Generation
```typescript
// Happens after payment verification
- Create secure key (cryptographic)
- Bind to user_id + product_id + duration
- Set expiry date based on duration
- Generate unique signature for offline validation
```

### Key Validation
```typescript
// Before APK download
- Check key exists
- Check key not expired
- Check key status (used/unused)
- Optional device binding validation
```

### Key Delivery
```typescript
// Async email delivery
- Generate unique download link token
- Send email with license key
- Include product name + duration + expiry
- Include download link with token
- Track email delivery status
```

## Reseller System

### Plan Structure
```
Entry Plan: $199/month
- Up to 100 keys/month
- 10% commission
- Email support

Pro Plan: $499/month
- Up to 1000 keys/month
- 15% commission
- Priority support

Enterprise: $999/month
- Unlimited keys
- 20% commission
- Dedicated account manager
```

### Key Generation by Reseller
```typescript
// Requires active plan subscription
await generateKeys(productId, quantity, durationDays);

// Deducts from wallet balance
// Creates keys in key pool
// Can sell to end customers
// Earns commission on each sale
```

## Security Features

### Row Level Security (RLS)
- Orders: Only user or linked reseller can view
- Favorites: Only user can view/modify
- Licenses: Only owner can validate/download

### License Key Protection
- Cryptographic signature for offline validation
- Device binding (optional)
- Usage tracking
- Expiration enforcement

### APK Download Protection
- Requires valid license key
- Expiring download tokens (24-48 hours)
- Limited downloads per key (configurable)
- Device ID logging

### Payment Security
- All sensitive data masked
- Only provider name shown to users
- Transaction verification required
- Fraud detection hooks
- Webhook validation

### User Data
- Sensitive banking details encrypted
- API keys never exposed in logs
- Regular audit trails
- GDPR compliant data storage

## Deployment Notes

### Environment Variables Needed
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_key
VITE_PAYMENT_GATEWAY_KEYS={provider_specific}
```

### Database Migrations
1. Run migration: `20260410060000_complete_public_marketplace.sql`
2. Configure RLS policies
3. Set up payment gateway webhooks
4. Configure email service

### API Gateway Functions
Backend functions needed in Supabase:
- `api-gateway/marketplace/products`
- `api-gateway/marketplace/payments`
- `api-gateway/marketplace/licenses`
- `api-gateway/marketplace/orders`
- `api-gateway/marketplace/favorites`
- `api-gateway/marketplace/wallet`
- `api-gateway/marketplace/reseller/*`
- `api-gateway/marketplace/notifications`

### Email Service
- Configure SendGrid/Mailgun/AWS SES
- Create email templates for:
  - License key delivery
  - Payment receipts
  - Order confirmations
  - License expiry reminders
  - Reseller earnings reports

## Performance Optimization

### Frontend
- Lazy load product images
- Debounced search (300ms)
- Memoized product filtering
- Pagination for large result sets
- Virtual scrolling for long lists (future)

### Database
- Indexes on frequently filtered columns
- Composite indexes for common queries
- Pagination indexes
- Materialized views for analytics (future)

### Caching
- Cache product list (5 min)
- Cache categories (1 hour)
- Cache user preferences (session)

## Monitoring & Analytics

### Key Metrics
- Total products listed
- Products with sales
- Total revenue
- Average order value
- License key usage
- Demo access sessions
- Reseller performance
- Payment success rate

### Logging
- All payment attempts
- License generation
- Download events
- Demo access
- API errors

## Troubleshooting

### Common Issues

1. **Payment Not Verifying**
   - Check payment gateway webhook
   - Verify transaction reference in database
   - Check payment logs table for error

2. **License Key Not Delivered**
   - Check email logs table
   - Verify email service credentials
   - Check email template rendering

3. **Download Link Broken**
   - Verify license key validity
   - Check download link token expiry
   - Verify APK file still exists

4. **Reseller Key Generation Fails**
   - Check wallet balance
   - Verify active plan subscription
   - Check plan key limit

## Future Enhancements

1. **Advanced Features**
   - Subscription-based license renewal
   - License transfer between users
   - Bulk license purchase
   - API for third-party integrations

2. **Analytics**
   - Customer lifetime value
   - Cohort analysis
   - Revenue forecasting
   - Reseller performance analytics

3. **Marketing**
   - Coupon codes
   - Affiliate program
   - Bundle pricing
   - Seasonal promotions

4. **Operations**
   - Admin dashboard for marketplace
   - Reseller onboarding workflow
   - Dispute resolution system
   - Refund management

## Support

For issues or questions:
1. Check database schema for data consistency
2. Review payment logs for API errors
3. Check email logs for delivery issues
4. Verify RLS policies are enabled
5. Test API endpoints with sample data
