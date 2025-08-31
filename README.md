# 🎰 AI-Roulette

**Play, bet, and spin - AI-assisted roulette in your browser.**

A modern, multiplayer roulette game with AI assistance, voice commands, and real-time gameplay. Built with React, FastAPI, and Supabase.

## ✨ Features

- **🎮 Interactive Roulette Table**: Click to place bets on numbers, colors, and groups
- **🎤 Voice Betting**: Use natural language commands like "bet 10 on red"
- **🤖 AI Assistant**: Get help with rules, strategies, and automated bet parsing
- **📊 Real-time Analytics**: Hot/cold numbers, recent spins, and leaderboards
- **👥 Multiplayer**: Join lobbies with other players
- **💰 Balance Tracking**: Start with $100, win or lose based on your bets
- **🔄 Backup Systems**: Fallback parsers ensure functionality without external APIs

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Supabase** for authentication
- **Web Speech API** for voice input

### Backend
- **FastAPI** with Python
- **Supabase** (PostgreSQL + Auth)
- **WebSockets** for real-time updates
- **OpenAI API** (optional, with backup parser)
- **Pydantic** for data validation

### Deployment
- **Frontend**: Netlify/Vercel
- **Backend**: Railway/Render
- **Database**: Supabase

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- Supabase account

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd Ai-Roulette
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Supabase credentials
python main.py
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

### 4. Database Setup
1. Create a new Supabase project
2. Run the SQL schema from `docs/database-schema.sql`
3. Update your `.env` files with the credentials

## 🎯 Game Rules

### Betting Types & Payouts
- **Straight (Single Number)**: 35:1
- **Red/Black**: 1:1
- **Even/Odd**: 1:1
- **Low (1-18) / High (19-36)**: 1:1
- **Dozens/Columns**: 2:1

### Voice Commands
- "Bet 10 on red"
- "Place 5 on black"
- "Put 25 on number 7"
- "Bet 15 on even"

### AI Assistant
Ask about rules, strategies, or get help with betting. The AI can also parse natural language betting commands automatically.

## 🏗️ Project Structure

```
Ai-Roulette/
├── frontend/                 # React TypeScript app
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/           # Custom hooks
│   │   └── ...
│   └── package.json
├── backend/                  # FastAPI server
│   ├── models/              # Pydantic models
│   ├── services/            # Business logic
│   ├── utils/               # Utilities
│   └── main.py
├── docs/                    # Documentation
│   └── database-schema.sql
└── README.md
```

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key  # Optional
```

**Frontend (.env.local)**
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:8000
```

## 🚀 Deployment

### Frontend (Netlify)
```bash
cd frontend
npm run build
# Deploy dist/ folder to Netlify
```

### Backend (Railway)
```bash
cd backend
# Connect to Railway and deploy
railway deploy
```

## 🧪 Development Features

- **Mock Data**: Works without Supabase for initial development
- **Backup Parser**: Betting commands work without OpenAI API
- **Hot Reload**: Both frontend and backend support live reloading
- **TypeScript**: Full type safety across the application

## 🎮 How to Play

1. **Sign Up/Login**: Create an account to start with $100
2. **Join Lobby**: Enter the game lobby with other players
3. **Place Bets**: Click chips, then click the table to bet
4. **Voice Betting**: Use the microphone for voice commands
5. **AI Help**: Chat with the AI for guidance and strategies
6. **Spin & Win**: Watch the wheel spin and collect winnings!

## 🔒 Security Features

- Row Level Security (RLS) in Supabase
- JWT authentication
- Input validation and sanitization
- Rate limiting on API endpoints

## 📱 Browser Support

- **Voice Input**: Chrome, Edge, Safari (latest versions)
- **General**: All modern browsers
- **Mobile**: Responsive design for mobile play

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎯 Roadmap

- [ ] Tournament mode
- [ ] Social features (friends, chat)
- [ ] Advanced betting strategies
- [ ] Mobile app versions
- [ ] Cryptocurrency integration

---

**Ready to spin? Start your engines and may the odds be in your favor! 🎰**
