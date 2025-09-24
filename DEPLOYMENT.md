# 🚀 EduLab Deployment Guide

Hướng dẫn chi tiết triển khai EduLab lên production environment.

## 📋 Checklist triển khai

### ✅ Pre-deployment
- [ ] Test tất cả tính năng trên local
- [ ] Chạy performance audit
- [ ] Kiểm tra browser compatibility
- [ ] Review security settings
- [ ] Backup dữ liệu hiện tại (nếu có)

### ✅ Production Setup
- [ ] HTTPS configuration
- [ ] Web server optimization
- [ ] CDN setup (optional)
- [ ] Monitoring setup
- [ ] Error logging

## 🌐 Web Server Configuration

### Apache (.htaccess)

```apache
# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache control
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src https://phet.colorado.edu; connect-src 'self'"
</IfModule>

# Redirect to HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Document root
    root /var/www/edulab;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Cache control
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src https://phet.colorado.edu; connect-src 'self'";
    
    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/";
    }
}
```

## 🐳 Docker Deployment

### Dockerfile

```dockerfile
FROM nginx:alpine

# Copy application files
COPY . /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  edulab:
    build: .
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    
  # Optional: Add monitoring
  monitoring:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
```

### Triển khai với Docker

```bash
# Build image
docker build -t edulab:latest .

# Run container
docker run -d \
  --name edulab \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/ssl:/etc/nginx/ssl:ro \
  edulab:latest

# Or use docker-compose
docker-compose up -d
```

## ☁️ Cloud Deployment

### Vercel

1. **Connect GitHub repository**
2. **Configure build settings**:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "**/*",
         "use": "@vercel/static"
       }
     ],
     "routes": [
       {
         "src": "/sw.js",
         "headers": { "cache-control": "no-cache" }
       },
       {
         "src": "/(.*)",
         "dest": "/$1"
       }
     ]
   }
   ```

### Netlify

1. **Connect repository**
2. **Build settings**:
   - Build command: (none)
   - Publish directory: `/`
3. **Configure redirects** in `_redirects`:
   ```
   /sw.js  /sw.js  200
   /*      /index.html  200
   ```

### GitHub Pages

1. **Enable GitHub Pages** in repository settings
2. **Configure custom domain** (optional)
3. **Add CNAME file** for custom domain
4. **Setup GitHub Actions** for auto-deployment:

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./
```

## 🔧 Performance Optimization

### Image Optimization

```bash
# Install imagemin
npm install -g imagemin imagemin-mozjpeg imagemin-pngquant

# Optimize images
imagemin assets/images/*.{jpg,png} --out-dir=assets/images/optimized \
  --plugin=mozjpeg --plugin=pngquant
```

### Bundle Analysis

```bash
# Analyze bundle size
npx bundlephobia [package-name]

# Check lighthouse scores
npx lighthouse https://your-domain.com --output html --output-path ./lighthouse-report.html
```

### CDN Setup

```html
<!-- Example: jsDelivr CDN for static assets -->
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/yourusername/edulab@main/css/styles.css">
```

## 📊 Monitoring và Analytics

### Google Analytics 4

```html
<!-- Add to <head> section -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Error Monitoring (Sentry)

```javascript
// Add to main.js
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production"
});
```

### Performance Monitoring

```javascript
// Add to performance-optimizer.js
if ('performance' in window) {
  window.addEventListener('load', () => {
    const perfData = performance.getEntriesByType('navigation')[0];
    
    // Send to analytics
    gtag('event', 'timing_complete', {
      name: 'load',
      value: Math.round(perfData.loadEventEnd - perfData.loadEventStart)
    });
  });
}
```

## 🔐 Security Best Practices

### Content Security Policy

```javascript
// Advanced CSP configuration
const CSP_POLICY = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  font-src 'self' https://fonts.gstatic.com;
  frame-src https://phet.colorado.edu;
  connect-src 'self' https://www.google-analytics.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\s+/g, ' ').trim();
```

### Environment Variables

```bash
# .env.production
NODE_ENV=production
ENABLE_ANALYTICS=true
SENTRY_DSN=your_sentry_dsn
API_BASE_URL=https://api.edulab.vn
```

## 🧪 Testing in Production

### Smoke Tests

```bash
# Test critical paths
curl -f https://your-domain.com/ || exit 1
curl -f https://your-domain.com/browse.html || exit 1
curl -f https://your-domain.com/data/simulations.json || exit 1
```

### Performance Tests

```javascript
// Performance budget
const PERFORMANCE_BUDGET = {
  FCP: 1500,  // First Contentful Paint
  LCP: 2500,  // Largest Contentful Paint
  FID: 100,   // First Input Delay
  CLS: 0.1    // Cumulative Layout Shift
};
```

## 📝 Maintenance

### Regular Tasks

- [ ] **Weekly**: Check error logs và performance metrics
- [ ] **Monthly**: Update dependencies và security patches
- [ ] **Quarterly**: Review và optimize performance
- [ ] **Yearly**: Security audit và infrastructure review

### Backup Strategy

```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/edulab_$DATE"

# Create backup
mkdir -p $BACKUP_DIR
cp -r /var/www/edulab/* $BACKUP_DIR/

# Compress
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

# Keep only last 30 days
find /backups -name "edulab_*.tar.gz" -mtime +30 -delete
```

### Update Process

1. **Staging deployment** → Test → **Production deployment**
2. **Monitor** error rates và performance
3. **Rollback plan** nếu có issues
4. **Communication** với users về downtime

## 🆘 Troubleshooting

### Common Issues

**SSL Certificate Issues**
```bash
# Check certificate
openssl x509 -in certificate.crt -text -noout

# Test SSL configuration
curl -vI https://your-domain.com
```

**Service Worker Issues**
```javascript
// Debug service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('SW registrations:', registrations);
  });
}
```

**Performance Issues**
```bash
# Check resource usage
htop
iostat
netstat -i
```

### Emergency Contacts

- **DevOps**: devops@edulab.vn
- **Security**: security@edulab.vn
- **Support**: support@edulab.vn

---

**📞 24/7 Emergency Hotline**: +84-xxx-xxx-xxx

