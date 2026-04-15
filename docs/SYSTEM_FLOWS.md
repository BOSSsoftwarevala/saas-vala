# SaaS VALA - Complete System Flows Documentation

## Table of Contents
1. [Authentication Flow](#authentication-flow)
2. [Dashboard Load Flow](#dashboard-load-flow)
3. [Wallet Hard Lock Flow](#wallet-hard-lock-flow)
4. [Product Management Flow](#product-management-flow)
5. [APK Pipeline Flow](#apk-pipeline-flow)
6. [Marketplace Flow](#marketplace-flow)
7. [Purchase & Wallet Flow](#purchase--wallet-flow)
8. [Key Management Flow](#key-management-flow)
9. [Reseller Management Flow](#reseller-management-flow)
10. [Server Deployment Flow](#server-deployment-flow)
11. [AI Chat Flow](#ai-chat-flow)
12. [AI APIs Flow](#ai-apis-flow)
13. [Auto-Pilot Flow](#auto-pilot-flow)
14. [SEO & Leads Flow](#seo--leads-flow)
15. [Support Flow](#support-flow)
16. [Audit Logs Flow](#audit-logs-flow)
17. [System Health Flow](#system-health-flow)
18. [Settings Flow](#settings-flow)

---

## Authentication Flow

### Login Entry
```
User opens app
  ↓
Check localStorage for token
  ↓
IF no token:
  → Show login page
  ↓
User enters credentials
  ↓
POST /api/auth/login
  ↓
Backend validates credentials
  ↓
IF valid:
  → Return user + role + token
  → Save to localStorage
  → Load user data
  → Redirect to dashboard
ELSE:
  → Show error
```

### Auth Check (Middleware)
```
Every protected route:
  ↓
Check token in localStorage
  ↓
IF no token:
  → Redirect to /login
  ↓
Validate token with backend
  ↓
IF invalid:
  → Clear localStorage
  → Redirect to /login
  ↓
IF valid:
  → Load user + role + wallet
  → Continue to route
```

### Logout Flow
```
User clicks logout
  ↓
POST /api/auth/logout
  ↓
Backend invalidates token
  ↓
Clear localStorage
  ↓
Redirect to /login
```

---

## Dashboard Load Flow

### Main Dashboard Initialization
```
User navigates to /dashboard
  ↓
Auth check (middleware)
  ↓
Load dashboard data:
  - /api/stats (products, keys, resellers, servers)
  - /api/servers (server status)
  - /api/command-center (metrics)
  - /api/products/recent (recent products)
  - /api/audit-logs/recent (recent activity)
  ↓
Render dashboard components:
  - Stats cards
  - Server status
  - Command center
  - Quick actions
  - Recent products
  - Activity logs
  ↓
Enable real-time updates (WebSocket)
```

### Real-time Updates
```
Dashboard loaded
  ↓
Subscribe to WebSocket channels:
  - stats:updates
  - servers:status
  - activity:logs
  ↓
On message received:
  → Update relevant component state
  → Re-render
```

---

## Wallet Hard Lock Flow

### Wallet Check (System-wide)
```
User attempts any action
  ↓
GET /api/wallet/balance
  ↓
IF balance < $50:
  → BLOCK SYSTEM
  → Show wallet lock modal
  → Redirect to /wallet
  → Disable all action buttons
  → Show "Add Credits" CTA
ELSE:
  → Allow action to proceed
```

### Wallet Lock UI States
```
Wallet locked state:
  - Header shows warning banner
  - Sidebar items disabled (except Wallet)
  - Quick actions disabled
  - All forms disabled
  - Modal overlay with "Add Credits" button
  ↓
User adds credits
  ↓
Wallet balance >= $50
  ↓
Unlock system
  → Remove warning banner
  → Enable all controls
  → Dismiss modal
```

---

## Product Management Flow

### Create Product
```
Dashboard → Click "Add Product"
  ↓
Open product creation modal
  ↓
User fills form:
  - Name
  - Description
  - Price
  - Category
  - Features
  - SEO data
  ↓
Upload thumbnail (optional)
  ↓
POST /api/products
  ↓
Backend:
  - Validate data
  - Save to DB (products table)
  - Upload thumbnail to storage
  - Generate SEO metadata
  ↓
Return product ID
  ↓
Success toast
  ↓
Refresh product list
```

### Edit Product
```
Dashboard → Products → Click product
  ↓
Open product detail page
  ↓
Click "Edit"
  ↓
Load product data
  ↓
User modifies fields
  ↓
PATCH /api/products/:id
  ↓
Backend:
  - Update DB
  - Audit log entry
  ↓
Success toast
  ↓
Refresh product data
```

### Delete Product
```
Dashboard → Products → Click product
  ↓
Click "Delete"
  ↓
Show confirmation modal
  ↓
User confirms
  ↓
DELETE /api/products/:id
  ↓
Backend:
  - Soft delete (set deleted_at)
  - Audit log entry
  ↓
Success toast
  ↓
Redirect to products list
```

---

## APK Pipeline Flow

### Upload APK
```
Dashboard → Click "Upload APK"
  ↓
Open APK upload modal
  ↓
Select product (dropdown)
  ↓
Select APK file
  ↓
Upload progress bar
  ↓
POST /api/apk/upload (multipart/form-data)
  ↓
Backend:
  - Validate file (APK format)
  - Generate checksum
  - Upload to storage
  - Create version record
  - Link to product
  ↓
Return APK ID
  ↓
Success toast
  ↓
Refresh APK list
```

### Version Management
```
Dashboard → Products → Product → APKs tab
  ↓
Show APK versions list:
  - Version number
  - File size
  - Upload date
  - Download count
  - Status (active/inactive)
  ↓
Actions:
  - Set as active
  - Download
  - Delete
```

### Download APK
```
User on product page
  ↓
Click "Download APK"
  ↓
GET /api/apk/download/:id
  ↓
Backend:
  - Check user permissions
  - Verify product access
  - Generate signed URL
  ↓
Stream file to client
  ↓
Increment download count
```

---

## Marketplace Flow

### Marketplace Home
```
User navigates to /
  ↓
Load marketplace data:
  - Banners/sliders
  - Featured products
  - All products (paginated)
  - Categories
  ↓
Render marketplace UI:
  - Hero section with banners
  - Product cards grid
  - Category filters
  - Search bar
```

### Product Detail
```
Marketplace → Click product card
  ↓
GET /api/products/:id
  ↓
Load product data:
  - Product info
  - APK versions
  - Reviews
  - Related products
  ↓
Render product detail page:
  - Product info
  - Features list
  - Pricing
  - Download/Buy buttons
  - Reviews section
```

### Search & Filter
```
Marketplace → Search bar
  ↓
User types query
  ↓
Debounced search (500ms)
  ↓
GET /api/products/search?q={query}
  ↓
Return filtered products
  ↓
Update product grid
```

---

## Purchase & Wallet Flow

### Purchase Flow
```
Product detail → Click "Buy"
  ↓
Check user authentication
  ↓
IF not authenticated:
  → Redirect to login
  ↓
Check wallet balance
  ↓
IF balance < product price:
  → Show insufficient funds modal
  → Redirect to wallet
  ↓
Show purchase confirmation modal:
  - Product info
  - Price
  - Wallet balance
  ↓
User confirms
  ↓
POST /api/orders
  ↓
Backend:
  - Validate wallet balance
  - Deduct from wallet
  - Create order record
  - Generate key (if license product)
  - Assign key to user
  - Create transaction record
  - Send notification
  - Audit log entry
  ↓
Return success + key
  ↓
Show success modal with key
  ↓
Redirect to my products
```

### Wallet Add Credits
```
Dashboard → Click "Add Credits"
  ↓
Open wallet page
  ↓
Show current balance
  ↓
Select amount:
  - $10, $25, $50, $100, $200
  ↓
Select payment method:
  - Credit card
  - PayPal
  - Bank transfer
  ↓
Click "Add Credits"
  ↓
POST /api/wallet/add-credits
  ↓
Backend:
  - Process payment
  - Update wallet balance
  - Create transaction record
  - Send notification
  - Audit log entry
  ↓
Return success
  ↓
Refresh wallet balance
```

### Transaction History
```
Wallet page → Transaction history tab
  ↓
GET /api/wallet/transactions
  ↓
Load transactions:
  - Type (credit/debit/refund)
  - Amount
  - Description
  - Reference
  - Date
  ↓
Render transaction list (paginated)
```

---

## Key Management Flow

### Generate Key
```
Dashboard → Click "Generate Key"
  ↓
Open key generation modal
  ↓
Select product
  ↓
Select key type:
  - API key
  - Feature key
  - License key
  ↓
Set options:
  - Usage limit
  - Expiry date
  - Device binding
  ↓
POST /api/keys/generate
  ↓
Backend:
  - Generate secure key
  - Encrypt key value
  - Generate hash
  - Save to DB (keys table)
  - Audit log entry
  ↓
Return key ID
  ↓
Success toast
  ↓
Show generated key (one-time display)
```

### Assign Key
```
Dashboard → Keys → Select key
  ↓
Click "Assign"
  ↓
Open assignment modal
  ↓
Select user/reseller
  ↓
POST /api/keys/:id/assign
  ↓
Backend:
  - Update key assigned_user_id
  - Audit log entry
  - Send notification
  ↓
Success toast
  ↓
Refresh key list
```

### Validate Key
```
Client app validates key
  ↓
POST /api/keys/validate
  ↓
Backend:
  - Decrypt key hash
  - Check key status
  - Check expiry
  - Check usage limit
  - Verify device binding
  - Check geo/IP restrictions
  - Increment usage count
  - Log validation attempt
  ↓
Return validation result
  ↓
Client app:
  - IF valid: Grant access
  - IF invalid: Show error
```

### Revoke Key
```
Dashboard → Keys → Select key
  ↓
Click "Revoke"
  ↓
Show confirmation modal
  ↓
User confirms
  ↓
DELETE /api/keys/:id
  ↓
Backend:
  - Update key status to revoked
  - Deactivate all sessions
  - Audit log entry
  - Send notification
  ↓
Success toast
  ↓
Refresh key list
```

---

## Reseller Management Flow

### Create Reseller
```
Dashboard → Reseller Manager → Click "Add Reseller"
  ↓
Open reseller creation modal
  ↓
Fill form:
  - User (select existing or create new)
  - Commission rate (%)
  - Discount rate (%)
  - Max keys
  ↓
POST /api/resellers
  ↓
Backend:
  - Create reseller record
  - Assign role
  - Send welcome email
  - Audit log entry
  ↓
Success toast
  ↓
Refresh reseller list
```

### Reseller Dashboard
```
Reseller logs in
  ↓
Load reseller data:
  - Commission rate
  - Discount rate
  - Assigned keys
  - Total sales
  - Earnings
  ↓
Render reseller dashboard:
  - Stats cards
  - Assigned products
  - Sales history
  - Key management
```

### Reseller Purchase Flow
```
Reseller → Product → Click "Buy"
  ↓
Check reseller discount
  ↓
Calculate final price
  ↓
Show purchase confirmation:
  - Original price
  - Discount
  - Final price
  ↓
Reseller confirms
  ↓
POST /api/orders (reseller flow)
  ↓
Backend:
  - Apply discount
  - Deduct from reseller wallet
  - Create order
  - Generate key
  - Assign to reseller
  - Calculate commission
  ↓
Success
```

---

## Server Deployment Flow

### Deploy Server
```
Dashboard → Click "Deploy Server"
  ↓
Open server deployment modal
  ↓
Fill form:
  - Server name
  - Environment (prod/staging/dev)
  - Region
  - Configuration
  ↓
POST /api/servers/deploy
  ↓
Backend:
  - Create server record
  - Trigger deployment script
  - Update status to deploying
  - Audit log entry
  ↓
Return deployment ID
  ↓
Show deployment progress
  ↓
WebSocket updates:
  - Status changes
  - Progress percentage
  - Logs
  ↓
Deployment complete
  → Server status = online
```

### Server Monitoring
```
Dashboard → Servers tab
  ↓
Load server list:
  - Server name
  - Environment
  - Status (online/offline/deploying)
  - Region
  - Uptime
  ↓
Real-time updates (WebSocket):
  - Status changes
  - Heartbeat pings
  - Health metrics
```

### Server Actions
```
Dashboard → Servers → Select server
  ↓
Actions:
  - Restart
  - Stop
  - Delete
  - View logs
  - SSH access
  ↓
POST /api/servers/:id/{action}
  ↓
Backend:
  - Execute action
  - Update status
  - Audit log entry
  ↓
Return result
```

---

## AI Chat Flow

### Load AI Chat
```
Dashboard → AI Chat
  ↓
GET /api/ai/chats
  ↓
Load user's chats:
  - Chat list
  - Last message preview
  - Status (active/closed)
  ↓
IF no active chat:
  → Create new chat
  ↓
Render chat interface:
  - Chat list sidebar
  - Active chat messages
  - Input field
  - AI status indicator
```

### Send Message
```
AI Chat → Type message
  ↓
Click send
  ↓
POST /api/ai/chats/:id/messages
  ↓
Backend:
  - Save user message
  - Generate AI response
  - Save AI response
  - Update chat last_updated
  ↓
WebSocket update:
  - Broadcast new messages
  ↓
Render both messages
```

### AI Response Generation
```
User message received
  ↓
Select AI model (based on settings)
  ↓
POST /api/ai/query
  ↓
AI API integration:
  - Call AI provider
  - Send context (chat history)
  - Get response
  ↓
Format response
  ↓
Return to chat
  ↓
Save to DB
```

---

## AI APIs Flow

### API Request
```
Client app → AI API request
  ↓
POST /api/ai/query
  ↓
Backend:
  - Validate API key
  - Check rate limits
  - Select provider (based on priority/failover)
  - Call AI provider
  - Log usage
  - Calculate cost
  ↓
Return AI response
```

### Provider Management
```
Dashboard → AI APIs
  ↓
Load provider integrations:
  - Provider name
  - Model
  - Priority
  - Status
  - Daily usage
  - Daily cost
  ↓
Actions:
  - Add integration
  - Edit configuration
  - Toggle active
  - Set priority
  - Configure failover
  - Set limits
```

### Cost Control
```
AI API request
  ↓
Check daily cost limit
  ↓
IF limit exceeded:
  → Block request
  → Send alert
  ↓
Check daily token limit
  ↓
IF limit exceeded:
  → Block request
  → Send alert
  ↓
Process request
  ↓
Update daily usage
  ↓
Update daily cost
```

---

## Auto-Pilot Flow

### Auto-Pilot Trigger
```
Trigger sources:
  - Scheduled (cron)
  - Event-based
  - Manual
  ↓
Auto-Pilot engine starts
  ↓
Load configuration:
  - Enabled modules
  - Rules
  - Thresholds
```

### Auto Reply
```
New support ticket created
  ↓
Auto-Pilot detects
  ↓
Analyze ticket content
  ↓
Generate AI response
  ↓
IF confidence > threshold:
  → Post reply
  → Update ticket status
  → Notify assigned agent
ELSE:
  → Flag for manual review
```

### Auto Marketing
```
Scheduled task (daily)
  ↓
Auto-Pilot:
  - Generate marketing content
  - Create social posts
  - Send email campaigns
  - Update ads
  ↓
Track performance
  ↓
Optimize based on results
```

### Auto Tasks
```
Background tasks:
  - Cleanup old data
  - Expire keys
  - Reset daily limits
  - Send reminders
  - Generate reports
  ↓
Auto-Pilot executes
  ↓
Log results
  ↓
Alert on failures
```

---

## SEO & Leads Flow

### SEO Configuration
```
Dashboard → Products → Product → SEO tab
  ↓
Load SEO data:
  - Title
  - Description
  - Keywords
  - Open Graph tags
  ↓
User edits SEO fields
  ↓
PATCH /api/products/:id/seo
  ↓
Backend:
  - Update SEO data
  - Generate meta tags
  - Update sitemap
  - Audit log entry
  ↓
Success toast
```

### Lead Generation
```
Dashboard → SEO & Leads
  ↓
Load lead data:
  - Total leads
  - Conversion rate
  - Sources
  - Recent leads
  ↓
Actions:
  - Configure lead forms
  - Set up campaigns
  - Track analytics
```

### Lead Capture
```
User fills lead form
  ↓
POST /api/leads
  ↓
Backend:
  - Validate data
  - Save to DB
  - Send notification
  - Assign to sales
  - Start drip campaign
  ↓
Success response
```

---

## Support Flow

### Create Ticket
```
User → Support page
  ↓
Click "New Ticket"
  ↓
Fill form:
  - Subject
  - Category
  - Priority
  - Description
  ↓
POST /api/support/tickets
  ↓
Backend:
  - Create ticket
  - Assign to agent
  - Send notification
  - Audit log entry
  ↓
Return ticket ID
  ↓
Success toast
```

### Ticket Management
```
Dashboard → Support
  ↓
Load tickets:
  - All tickets (Boss/Admin)
  - Assigned tickets (Agent)
  - My tickets (User)
  ↓
Filter by:
  - Status
  - Priority
  - Category
  ↓
Actions:
  - View details
  - Add response
  - Change status
  - Reassign
  - Close ticket
```

### Response Flow
```
Ticket detail → Add response
  ↓
Type response
  ↓
Toggle "Internal" (for agent notes)
  ↓
POST /api/support/tickets/:id/responses
  ↓
Backend:
  - Save response
  - Update ticket status
  - Send notification
  - Audit log entry
  ↓
Success toast
  ↓
Refresh ticket
```

---

## Audit Logs Flow

### Log Generation
```
Every action (middleware)
  ↓
Extract data:
  - User ID
  - Action
  - Entity type
  - Entity ID
  - Old values (for updates)
  - New values
  - IP address
  - User agent
  ↓
INSERT INTO audit_logs
  ↓
Continue request
```

### Log Viewing
```
Dashboard → Audit Logs
  ↓
Load logs (paginated):
  - All logs (Boss)
  - User logs (Admin/Reseller)
  ↓
Filter by:
  - Date range
  - Action type
  - Entity type
  - User
  ↓
Export options:
  - CSV
  - JSON
  - PDF
```

### Log Search
```
Audit Logs → Search bar
  ↓
Enter search query
  ↓
GET /api/audit-logs/search?q={query}
  ↓
Backend:
  - Full-text search
  - Filter by user permissions
  ↓
Return matching logs
```

---

## System Health Flow

### Health Checks
```
Scheduled (every minute)
  ↓
Check services:
  - Database (ping + query)
  - API (ping + endpoint test)
  - Storage (ping + upload test)
  - CDN (ping + latency)
  - External APIs (ping)
  ↓
Record metrics:
  - Response time
  - Status (healthy/degraded/down)
  - Uptime
  ↓
Save to system_health table
```

### Health Dashboard
```
Dashboard → System Health
  ↓
Load health data:
  - Service status
  - Response times
  - Uptime percentages
  - Last check times
  ↓
Render health cards:
  - Green = healthy
  - Yellow = degraded
  - Red = down
  ↓
Real-time updates (WebSocket)
```

### Alerting
```
Health check detects issue
  ↓
IF status = down:
  → Send critical alert
  → Page on-call
  ↓
IF status = degraded:
  → Send warning alert
  → Log for review
  ↓
IF status = healthy (after issue):
  → Send recovery alert
  → Update incident status
```

---

## Settings Flow

### User Settings
```
Dashboard → Settings
  ↓
Load user settings:
  - Profile
  - Preferences
  - Notifications
  - Security
  ↓
User edits settings
  ↓
PATCH /api/settings/user
  ↓
Backend:
  - Update settings
  - Audit log entry
  ↓
Success toast
```

### System Settings (Boss Only)
```
Dashboard → Settings → System tab
  ↓
Load system settings:
  - General config
  - Security settings
  - Feature flags
  - Rate limits
  - Email settings
  ↓
Boss edits settings
  ↓
PATCH /api/settings/system
  ↓
Backend:
  - Validate permissions (Boss only)
  - Update settings
  - Clear relevant caches
  - Audit log entry
  ↓
Success toast
```

### Notification Preferences
```
Settings → Notifications tab
  ↓
Load notification preferences:
  - Email (enabled/disabled)
  - In-app (enabled/disabled)
  - Webhook URLs
  - Per-type settings
  ↓
User updates preferences
  ↓
PATCH /api/settings/notifications
  ↓
Backend:
  - Update preferences
  - Audit log entry
  ↓
Success toast
```

---

## Complete System Flow Summary

### User Journey (End-to-End)
```
1. Login
   ↓
2. Dashboard (stats, status, quick actions)
   ↓
3. Browse Marketplace
   ↓
4. View Product
   ↓
5. Purchase Product
   ↓
6. Wallet Deduction
   ↓
7. Key Assignment
   ↓
8. Download APK
   ↓
9. Activate License
   ↓
10. Use Product
   ↓
11. Get Support (if needed)
   ↓
12. Renew Subscription
```

### Admin Journey (End-to-End)
```
1. Login (Boss/Admin)
   ↓
2. Dashboard (command center, metrics)
   ↓
3. Manage Products
   ↓
4. Upload APKs
   ↓
5. Generate Keys
   ↓
6. Manage Resellers
   ↓
7. Monitor Servers
   ↓
8. Review Support Tickets
   ↓
9. Check Audit Logs
   ↓
10. Configure Settings
```

### Core Rules
- Every action → API → DB → UI
- No direct UI fake data
- No null responses
- No blank renders
- All routes protected by auth
- Wallet controls system access
- Real-time updates where applicable
- Audit logging for all actions
- Role-based access control

---

## Route Configuration

### Public Routes
```
/ - Marketplace
/login - Login page
/register - Registration page
/forgot-password - Password reset
```

### Protected Routes (All authenticated users)
```
/dashboard - Dashboard
/products - Products
/product/:id - Product detail
/wallet - Wallet
/ai-chat - AI Chat
/settings - Settings
/support - Support
```

### Boss/Admin Routes
```
/boss - Boss Dashboard (Boss only)
/marketplace-admin - Marketplace Admin
/reseller-manager - Reseller Manager
/keys - Key Management
/servers - Server Management
/ai-apis - AI APIs
/audit-logs - Audit Logs
/system-health - System Health
/apk - APK Pipeline
```

### Reseller Routes
```
/reseller-dashboard - Reseller Dashboard
/my-products - Assigned Products
/my-keys - Assigned Keys
/sales-report - Sales Report
```

---

## API Endpoints Summary

### Authentication
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/register
- POST /api/auth/forgot-password

### Products
- GET /api/products
- GET /api/products/:id
- POST /api/products
- PATCH /api/products/:id
- DELETE /api/products/:id
- GET /api/products/search

### APK
- POST /api/apk/upload
- GET /api/apk/download/:id
- GET /api/apk/:product_id

### Keys
- POST /api/keys/generate
- GET /api/keys
- GET /api/keys/:id
- PATCH /api/keys/:id
- DELETE /api/keys/:id
- POST /api/keys/:id/assign
- POST /api/keys/validate

### Wallet
- GET /api/wallet/balance
- POST /api/wallet/add-credits
- GET /api/wallet/transactions

### Orders
- POST /api/orders
- GET /api/orders
- GET /api/orders/:id

### Resellers
- POST /api/resellers
- GET /api/resellers
- PATCH /api/resellers/:id

### Servers
- POST /api/servers/deploy
- GET /api/servers
- PATCH /api/servers/:id
- DELETE /api/servers/:id

### AI
- POST /api/ai/query
- GET /api/ai/chats
- POST /api/ai/chats
- POST /api/ai/chats/:id/messages

### Support
- POST /api/support/tickets
- GET /api/support/tickets
- POST /api/support/tickets/:id/responses

### Audit Logs
- GET /api/audit-logs
- GET /api/audit-logs/search

### System Health
- GET /api/system/health
- GET /api/system/metrics

### Settings
- GET /api/settings
- PATCH /api/settings
