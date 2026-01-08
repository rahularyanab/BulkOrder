# 📱 B2B RetailHub - Android Deployment Guide

## Quick Start - Build APK (FREE)

### Step 1: Create Expo Account (One-time)
1. Go to https://expo.dev/signup
2. Create a FREE account
3. Note your username

### Step 2: Login to EAS
```bash
cd /app/frontend
npx eas-cli login
```

### Step 3: Configure Project
```bash
npx eas-cli init
# When prompted, select "Create a new project"
```

### Step 4: Build APK
```bash
# Build preview APK (for testing/distribution)
npx eas-cli build --platform android --profile preview
```

This will:
- Upload your code to Expo's build servers
- Build an APK file (~15-20 minutes)
- Provide a download link

### Step 5: Download & Share
1. After build completes, you'll get a URL like:
   `https://expo.dev/artifacts/eas/xxxxx.apk`
2. Download the APK
3. Share via WhatsApp, Email, or host on your website

---

## Distribution Options (All FREE)

### Option A: WhatsApp/Telegram
1. Download APK from Expo
2. Send directly to retailers
3. They install and use

### Option B: Firebase App Distribution
1. Go to https://console.firebase.google.com
2. Create project → App Distribution
3. Upload APK
4. Invite testers via email

### Option C: Host on Website
1. Upload APK to your server/Google Drive
2. Share download link
3. Users download and install

---

## Build Profiles

| Profile | Command | Use Case |
|---------|---------|----------|
| Preview | `eas build --profile preview` | Testing & distribution |
| Production | `eas build --profile production` | Play Store (.aab) |

---

## Backend Deployment (Cheapest)

### Option 1: Railway.app ($5/month)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Option 2: Render.com (FREE tier)
1. Connect GitHub repo
2. Create Web Service
3. Set environment variables
4. Deploy

### Option 3: Fly.io (FREE tier)
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

---

## Environment Variables for Production

Update `eas.json` production profile:
```json
"env": {
  "EXPO_PUBLIC_BACKEND_URL": "https://your-backend-url.com"
}
```

---

## Estimated Costs

| Item | Cost |
|------|------|
| Expo EAS Build (30 free/month) | FREE |
| APK Distribution | FREE |
| Backend (Render free tier) | FREE |
| MongoDB Atlas (512MB) | FREE |
| **Total** | **$0** |

For scaling:
| Item | Cost |
|------|------|
| Google Play Store | $25 one-time |
| Railway backend | $5/month |
| MongoDB Atlas M0 | FREE |

---

## Commands Reference

```bash
# Login to Expo
npx eas-cli login

# Initialize project
npx eas-cli init

# Build preview APK
npx eas-cli build --platform android --profile preview

# Build production AAB (for Play Store)
npx eas-cli build --platform android --profile production

# Submit to Play Store
npx eas-cli submit --platform android

# Check build status
npx eas-cli build:list
```

---

## Troubleshooting

### "Project not found"
Run `npx eas-cli init` to create project on Expo servers

### "Build failed"
Check build logs at https://expo.dev/accounts/YOUR_USERNAME/projects

### "APK won't install"
Enable "Install from unknown sources" on Android device

---

## Support

- Expo Docs: https://docs.expo.dev/build/introduction/
- EAS Build: https://docs.expo.dev/build/setup/
