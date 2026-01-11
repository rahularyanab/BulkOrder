# Fly.io Deployment Guide for SaudaSetu Backend

## Prerequisites
- Fly.io account (free): https://fly.io/app/sign-up
- Fly CLI installed

## Step 1: Install Fly CLI

**Mac:**
```bash
brew install flyctl
```

**Windows (PowerShell):**
```powershell
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

## Step 2: Login to Fly.io

```bash
fly auth login
```

This will open a browser for authentication.

## Step 3: Deploy the App

Navigate to the backend folder and run:

```bash
cd backend
fly launch
```

When prompted:
- **App name:** `saudasetu-api` (or your preferred name)
- **Region:** Choose `bom` (Mumbai) for India
- **Database:** Select No (we use MongoDB Atlas)
- **Deploy now:** Yes

## Step 4: Set Environment Variables

Set your secrets (these won't be in the code):

```bash
fly secrets set MONGO_URL="mongodb+srv://agrifinance_user:AgriFinanceRahul@saudasetu.hbjhs8y.mongodb.net/?retryWrites=true&w=majority&appName=SaudaSetu"
fly secrets set DB_NAME="saudasetu"
fly secrets set MSG91_AUTH_KEY="487561AGRLHhDQZJ6962fb62P1"
fly secrets set MSG91_SENDER_ID="GRPBUY"
fly secrets set MSG91_TEMPLATE_ID="696300212d25c82d4805a9d2"
fly secrets set SMS_ENABLED="false"
fly secrets set JWT_SECRET="your-secure-random-secret-key-change-this"
```

## Step 5: Get Your App URL

After deployment, your API will be available at:
```
https://saudasetu-api.fly.dev
```

## Step 6: Update Your APK

Update the frontend `.env` file with your new backend URL:
```
EXPO_PUBLIC_BACKEND_URL=https://saudasetu-api.fly.dev
```

Then rebuild your APK.

## Useful Commands

```bash
# Check app status
fly status

# View logs
fly logs

# SSH into the machine
fly ssh console

# Redeploy after changes
fly deploy

# Scale (if needed)
fly scale count 1
```

## Estimated Cost

- Free tier includes 3 shared-cpu-1x VMs
- With 256MB RAM and auto_stop disabled: ~$0-3/month
- Monitor usage at: https://fly.io/dashboard

## Troubleshooting

**App not starting?**
```bash
fly logs
```

**Need to update secrets?**
```bash
fly secrets set KEY="value"
```

**Redeploy after code changes?**
```bash
fly deploy
```
