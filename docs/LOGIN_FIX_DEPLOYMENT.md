# Login Fix - Deployment Instructions

## Issue Fixed
Login was failing with "Failed to fetch (invalid.supabase.local)" error due to hardcoded invalid Supabase URL fallbacks in the codebase.

## Changes Made

### 1. Fixed `src/integrations/supabase/client.ts`
- Replaced `'https://invalid.supabase.local'` fallback with proper error throwing
- Now throws clear error if environment variables are not configured

### 2. Fixed `src/lib/api.ts`
- Replaced `'https://invalid.supabase.local'` fallback with proper error throwing  
- Now throws clear error if environment variables are not configured

### 3. Production Build
- Successfully rebuilt with fixed configuration
- Build output in `dist/` folder

## Environment Variables (Already Configured)
The `.env` file already has the correct Supabase configuration:
```
VITE_SUPABASE_URL="https://astmdnelnuqwpdbyzecr.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdG1kbmVsbnVxd3BkYnl6ZWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODg3MjQsImV4cCI6MjA4NTc2NDcyNH0.3iCTFzYa7KBSNhkiUwZ2XcnboKZxqjgdzAyti8Jh1sY"
```

## Manual Deployment to VPS

Since automated deployment encountered SSH/file transfer issues, use these manual steps:

### Option 1: Using SCP from Linux/Mac
```bash
# Upload dist folder to VPS
scp -r dist/* root@72.61.236.249:/var/www/saasvala-site/

# Set permissions and restart nginx
ssh root@72.61.236.249 'cd /var/www/saasvala-site && chown -R www-data:www-data /var/www/saasvala-site && find /var/www/saasvala-site -type d -exec chmod 755 {} \; && find /var/www/saasvala-site -type f -exec chmod 644 {} \; && nginx -t && systemctl reload nginx'
```

### Option 2: Using File Transfer Client (WinSCP/FileZilla)
1. Connect to VPS: `root@72.61.236.249`
2. Navigate to `/var/www/saasvala-site/`
3. Delete all existing files
4. Upload all files from `dist/` folder
5. Set permissions via SSH:
```bash
ssh root@72.61.236.249 'cd /var/www/saasvala-site && chown -R www-data:www-data /var/www/saasvala-site && find /var/www/saasvala-site -type d -exec chmod 755 {} \; && find /var/www/saasvala-site -type f -exec chmod 644 {} \; && nginx -t && systemctl reload nginx'
```

### Option 3: Using Git on VPS
```bash
ssh root@72.61.236.249

# Navigate to deployment directory
cd /var/www/saasvala-site

# Pull latest changes (if using git)
git pull origin main

# Or if not using git, manually copy files
# Then run:
chown -R www-data:www-data /var/www/saasvala-site
find /var/www/saasvala-site -type d -exec chmod 755 {} \;
find /var/www/saasvala-site -type f -exec chmod 644 {} \;
nginx -t
systemctl reload nginx
```

## Verification Steps

### 1. Check Deployment
```bash
ssh root@72.61.236.249 'ls -la /var/www/saasvala-site'
```
Should show the built files (index.html, assets/, etc.)

### 2. Test Website
Visit https://www.saasvala.com and verify:
- Page loads correctly
- No console errors
- Login page is accessible

### 3. Test Login Functionality
- Navigate to login page
- Enter credentials
- Verify login works without "Failed to fetch" error
- Check browser console for any errors

### 4. Check Nginx Status
```bash
ssh root@72.61.236.249 'systemctl status nginx'
```

## Troubleshooting

### If login still fails:
1. Clear browser cache and cookies
2. Check browser console for specific error messages
3. Verify Supabase project is active
4. Check Supabase dashboard for any service outages
5. Verify CORS settings in Supabase dashboard include your domain

### If deployment fails:
1. Ensure SSH connection works
2. Verify VPS disk space
3. Check nginx configuration
4. Verify file permissions

## Local Testing

The dev server is running locally at http://localhost:8081/ for testing before deployment.

## Summary

**Fixed Issues:**
- Removed hardcoded invalid Supabase URL fallbacks
- Added proper error handling for missing environment variables
- Rebuilt project with fixed configuration
- Ready for manual deployment to VPS

**Next Steps:**
1. Manually deploy `dist/` folder to VPS using one of the options above
2. Restart nginx on VPS
3. Test login functionality at https://www.saasvala.com
