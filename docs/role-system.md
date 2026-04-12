# SaaS Vala Role-Based Access Control (RBAC) System

## Overview
This document outlines the comprehensive role-based access control system implemented across the SaaS Vala platform, ensuring proper security and user experience based on user roles.

## Role Hierarchy

### 1. Super Admin
- **Level**: Highest privilege
- **Access**: Full system control
- **Home Path**: `/dashboard`
- **Permissions**: `['*']` - Unlimited access

### 2. Admin
- **Level**: High privilege
- **Access**: Platform management
- **Home Path**: `/dashboard`
- **Permissions**: 
  - `marketplace.product.manage`
  - `marketplace.reseller.manage`
  - `marketplace.reseller.payout`
  - `marketplace.analytics.view`
  - `marketplace.settings.manage`

### 3. Master Reseller
- **Level**: High business privilege
- **Access**: Advanced reseller features
- **Home Path**: `/reseller/dashboard`
- **Permissions**: Enhanced reseller capabilities

### 4. Reseller
- **Level**: Business privilege
- **Access**: Product sales and management
- **Home Path**: `/reseller/dashboard`
- **Permissions**: Product listing, sales tracking

### 5. Support
- **Level**: Operational privilege
- **Access**: Customer support features
- **Home Path**: `/support`
- **Permissions**: Ticket management, user assistance

### 6. User
- **Level**: Basic privilege
- **Access**: Product browsing and purchasing
- **Home Path**: `/`
- **Permissions**: Basic marketplace access

## Frontend Implementation

### Authentication Hook (`useAuth.tsx`)
```typescript
export type AppRole = 'super_admin' | 'admin' | 'reseller' | 'master_reseller' | 'support' | 'user';

function resolvePrimaryRole(roles: Array<{ role: string }>): AppRole {
  // Role hierarchy resolution
  if (roleSet.has('super_admin')) return 'super_admin';
  if (roleSet.has('admin')) return 'admin';
  // ... other roles
}
```

### Route Protection
```typescript
// ProtectedRoute - Requires authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <ProtectedShellProviders>{children}</ProtectedShellProviders>;
}

// AdminRoute - Requires admin privileges
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isReseller, homePath, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAdmin) return <Navigate to={isReseller ? '/reseller/dashboard' : homePath} replace />;
  return <>{children}</>;
}
```

### Role-Based UI Components

#### Header Navigation
```typescript
// Role-based menu items
{isSuperAdmin && (
  <DropdownMenuItem>System Settings</DropdownMenuItem>
)}
{!isSuperAdmin && isAdmin && (
  <DropdownMenuItem>Admin Panel</DropdownMenuItem>
)}
{role === 'reseller' && (
  <DropdownMenuItem>Reseller Dashboard</DropdownMenuItem>
)}
```

#### Sidebar Filtering
```typescript
// Admin-only menu items
{(item) => !item.adminOnly || isAdmin}
```

#### Marketplace Components
```typescript
// Role-based product card actions
const isAdmin = user?.role === 'admin';
const isReseller = user?.role === 'reseller';
const isUser = user?.role === 'user' || !user?.role;

// Show cart for users and resellers
{(isUser || isReseller) && (
  <Button>Add to Cart</Button>
)}
```

## Backend Implementation

### Role Resolution
```typescript
async function resolvePrimaryRole(admin: any, userId: string): Promise<string> {
  const { data } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  
  const roles = (data || []).map((r: any) => String(r.role));
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('admin')) return 'admin';
  // ... hierarchy resolution
  return roles[0] || 'user';
}
```

### Permission System
```typescript
async function hasMarketplacePermission(admin: any, userId: string, permission: string): Promise<boolean> {
  const roles = await getUserRoles(admin, userId);
  if (roles.includes('super_admin')) return true;
  
  // Check role permission mapping
  const { data: mapped } = await admin
    .from('role_permission_map')
    .select('granted, permissions!inner(name)')
    .in('role', roles)
    .eq('permissions.name', permission);
    
  // Check fallback permissions
  return roles.some((role) => {
    const grants = marketplaceRoleFallbackPermissions[role] ?? [];
    return grants.includes('*') || grants.includes(permission);
  });
}
```

### Fallback Permissions
```typescript
const marketplaceRoleFallbackPermissions: Record<string, string[]> = {
  super_admin: ['*'],
  admin: [
    'marketplace.product.manage',
    'marketplace.reseller.manage',
    'marketplace.reseller.payout',
    'marketplace.analytics.view',
    'marketplace.settings.manage'
  ],
  reseller: [
    'marketplace.product.view',
    'marketplace.product.purchase'
  ],
  user: [
    'marketplace.product.view',
    'marketplace.product.purchase'
  ]
};
```

## Database Schema

### Core Tables
```sql
-- User role assignments
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, role)
);

-- Role permission mapping
CREATE TABLE role_permission_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(50) NOT NULL,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions registry
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### AI Service Role Controls
```sql
-- AI service access by role
CREATE TABLE ai_role_access_controls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_name VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model_key VARCHAR(100),
  allowed_tasks TEXT[],
  max_requests_per_hour INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role-based rate limiting
CREATE TABLE ai_rate_limit_controls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_name VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  requests_per_hour INTEGER NOT NULL,
  tokens_per_hour INTEGER,
  is_active BOOLEAN DEFAULT true
);
```

## Route Protection Matrix

| Route | ProtectedRoute | AdminRoute | Required Role |
|-------|----------------|------------|---------------|
| `/dashboard` | ✅ | ✅ | Admin+ |
| `/products/deploy/:id` | ✅ | ✅ | Admin+ |
| `/keys/generate` | ✅ | ✅ | Admin+ |
| `/servers/deploy` | ✅ | ✅ | Admin+ |
| `/resellers/*` | ✅ | ✅ | Admin+ |
| `/leads/*` | ✅ | ✅ | Admin+ |
| `/settings` | ✅ | ✅ | Admin+ |
| `/audit-logs` | ✅ | ✅ | Admin+ |
| `/reseller/dashboard` | ✅ | ❌ | Reseller+ |
| `/wallet` | ✅ | ❌ | User+ |
| `/orders` | ✅ | ❌ | User+ |
| `/favorites` | ✅ | ❌ | User+ |
| `/ai-chat` | ✅ | ❌ | User+ |

## API Endpoint Protection

### Permission Checks
```typescript
// Marketplace admin operations
async function handleMarketplaceAdmin(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  // Require admin permission
  const missing = await requireMarketplacePermission(sb, userId, 'marketplace.admin.manage');
  if (missing) return missing;
  
  // Process admin operation
}
```

### Role-Based Data Access
```typescript
// Reseller-specific data
async function handleResellers(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const userRole = await resolvePrimaryRole(sb, userId);
  
  // Only admins can manage resellers
  if (!['admin', 'super_admin'].includes(userRole)) {
    return err('Insufficient permissions', 403);
  }
}
```

## Security Features

### 1. Multi-Layer Protection
- Frontend route guards
- Backend permission checks
- Database role constraints
- API endpoint validation

### 2. Audit Trail
```typescript
// Activity logging for role-based actions
await logActivity(admin, 'user', userId, 'role_assigned', operatorId, {
  previousRole: oldRole,
  newRole: newRole
});
```

### 3. Session Security
- JWT token validation
- Role verification on each request
- Automatic session expiration
- Secure token storage

## Testing & Validation

### Role Access Testing
1. **Authentication Flow**: Verify login and role assignment
2. **Route Protection**: Test unauthorized access blocking
3. **UI Rendering**: Confirm role-based component visibility
4. **API Permissions**: Validate backend permission enforcement
5. **Data Scoping**: Ensure proper data access by role

### Security Testing
1. **Privilege Escalation**: Attempt unauthorized role access
2. **Token Manipulation**: Test JWT token security
3. **Direct API Access**: Verify backend protection
4. **Cross-Role Data Access**: Ensure data isolation

## Best Practices

### 1. Principle of Least Privilege
- Grant minimum necessary permissions
- Regular permission audits
- Role-based data scoping

### 2. Defense in Depth
- Multiple validation layers
- Frontend and backend checks
- Database constraints

### 3. Audit & Monitoring
- Comprehensive logging
- Role change tracking
- Access pattern analysis

### 4. Scalability
- Flexible permission system
- Easy role addition/modification
- Permission inheritance

---

This role system provides comprehensive security and user experience management across the SaaS Vala platform, ensuring proper access control at all levels.
