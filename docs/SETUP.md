# 🚀 AI-Roulette Setup Guide

This guide will walk you through setting up the AI-Roulette project from scratch.

## Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Python 3.8+** - [Download here](https://python.org/)
- **Git** - [Download here](https://git-scm.com/)
- **Supabase Account** - [Sign up here](https://supabase.com/)

## Step 1: Project Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd Ai-Roulette

# Verify prerequisites
node --version  # Should be 18+
python --version  # Should be 3.8+
```

## Step 2: Supabase Database Setup

1. **Create New Project**
   - Go to [Supabase Dashboard](https://app.supabase.com/)
   - Click "New Project"
   - Choose organization and set project name
   - Set database password (save this!)
   - Wait for project to be ready

2. **Run Database Schema**
   - Go to SQL Editor in your Supabase dashboard
   - Copy contents of `docs/database-schema.sql`
   - Paste and run the SQL
   - Verify tables are created in Table Editor

3. **Get API Keys**
   - Go to Settings → API
   - Copy your Project URL and anon/public key
   - Save these for environment setup

## Step 3: Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
```

**Edit `.env` file:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
OPENAI_API_KEY=your-openai-key  # Optional
```

**Test backend:**
```bash
python main.py
# Should start on http://localhost:8000
# Visit http://localhost:8000/docs for API documentation
```

## Step 4: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
```

**Edit `.env.local` file:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8000
```

**Test frontend:**
```bash
npm run dev
# Should start on http://localhost:3000
```

## Step 5: Authentication Setup

1. **Configure Supabase Auth**
   - Go to Authentication → Settings
   - Set Site URL to `http://localhost:3000`
   - Enable email authentication
   - Optionally configure OAuth providers

2. **Test Authentication**
   - Visit http://localhost:3000
   - Try creating an account
   - Verify user appears in Authentication → Users

## Step 6: Optional Enhancements

### OpenAI Integration
```bash
# Get API key from https://platform.openai.com/
# Add to backend .env file
OPENAI_API_KEY=sk-your-key-here
```

### Voice Commands
- Voice input works automatically in Chrome/Edge
- No additional setup required
- Test by clicking microphone in game

## Step 7: Verify Everything Works

### Backend Health Check
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy","timestamp":"..."}
```

### Frontend Test
1. Open http://localhost:3000
2. Create account / login
3. Place a bet by clicking chips then table
4. Try voice command: "bet 5 on red"
5. Chat with AI assistant
6. Spin the wheel

## Common Issues & Solutions

### Backend Issues

**Import Errors**
```bash
# Make sure virtual environment is activated
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

**Database Connection Errors**
- Verify Supabase URL and keys in `.env`
- Check if database schema was run correctly
- Ensure Supabase project is active

### Frontend Issues

**Module Not Found**
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Environment Variables**
- Ensure `.env.local` file exists (not `.env`)
- Restart dev server after changing env vars
- Check browser console for specific errors

**TypeScript Errors**
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
npm run dev
```

### Authentication Issues

**Login/Signup Not Working**
- Check Supabase project settings
- Verify Site URL is set correctly
- Check browser network tab for API errors

**User Not Persisting**
- Check if RLS policies are set up correctly
- Verify JWT tokens in browser storage
- Check Supabase logs for errors

## Development Workflow

### Starting Development
```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
python main.py

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### Making Changes
- Backend changes auto-reload with uvicorn
- Frontend has hot module replacement
- Database changes require manual SQL execution

### Testing Features
1. **Betting System**: Click chips → click table → spin
2. **Voice Commands**: Click mic → speak command
3. **AI Chat**: Type questions in chat panel
4. **Real-time Updates**: Open multiple browser tabs

## Production Deployment

See main README.md for deployment instructions to:
- Frontend: Netlify/Vercel
- Backend: Railway/Render  
- Database: Supabase (already hosted)

## Getting Help

- Check browser console for frontend errors
- Check terminal output for backend errors
- Review Supabase logs for database issues
- Test API endpoints at http://localhost:8000/docs

---

**🎰 Ready to play? Your AI-powered roulette game awaits!**
