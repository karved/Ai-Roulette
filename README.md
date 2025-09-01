# 🎰 AI-Roulette

**Play, bet, and spin - AI-assisted roulette in your browser.**

A sophisticated, interactive multiplayer roulette game featuring AI assistance, voice commands, and real-time gameplay. This project demonstrates full-stack development skills, system architecture design, and creative UX implementation.

## 🎯 Project Overview

This take-home project showcases:
- **Full-Stack Architecture**: React TypeScript frontend with FastAPI Python backend
- **Interactive Gameplay**: Multi-input betting system (mouse, keyboard, voice)
- **AI Integration**: Dual-layer AI system with OpenAI + backup parser
- **Real-Time Features**: Live multiplayer lobbies and game state synchronization
- **Data Persistence**: Comprehensive user/game data storage with Supabase
- **Modern UX**: Optimistic UI updates with backend verification

## ✨ Features

- **🎮 Interactive Roulette Table**: Click to place bets on numbers, colors, and groups
- **🎤 Voice Betting**: Use natural language commands like "bet 10 on red"
- **🤖 AI Assistant**: Get help with rules, strategies, and automated bet parsing
- **📊 Real-time Analytics**: Hot/cold numbers, recent spins, and leaderboards *(Future)*
- **👥 Multiplayer**: Join lobbies with other players *(Future)*
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
- **Frontend**: Firebase/Netlify/Vercel
- **Backend**: Railway/Render
- **Database**: Supabase

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- Supabase account (free tier works)

### 1. Clone and Setup
```bash
git clone https://github.com/yourusername/Ai-Roulette.git
cd Ai-Roulette
```

### 2. Database Setup (Supabase)
1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `docs/corrected-database-schema.sql`
3. Note your project URL and anon key from Settings > API

### 3. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Create environment file
echo "SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key" > .env

# Start the server
python main.py
```

### 4. Frontend Setup
```bash
cd frontend
npm install

# Create environment file
echo "VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:8000" > .env.local

# Start the development server
npm run dev
```

### 5. Access the Game
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

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


## 🎯 Game Rules

### Betting Types & Payouts
- **Straight (Single Number)**: 35:1
- **Red/Black**: 1:1
- **Even/Odd**: 1:1
- **Low (1-18) / High (19-36)**: 1:1
- **Dozens/Columns**: 2:1
- **Split (2 numbers)**: 17:1
- **Street (3 numbers)**: 11:1
- **Corner (4 numbers)**: 8:1
- **Line (6 numbers)**: 5:1

### Voice Commands
- "Bet 10 on red"
- "Place 5 on black"
- "Put 25 on number 7"
- "Bet 15 on even"

### AI Assistant
Ask about rules, strategies, or get help with betting. The AI can also parse natural language betting commands automatically.

## 🏗️ System Architecture

### High-Level Design
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │◄──►│  FastAPI Server │◄──►│   Supabase DB   │
│   (Frontend)    │    │   (Backend)     │    │   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Web Speech API │    │   OpenAI API    │    │   Auth Service  │
│ (Voice Commands)│    │ (AI Assistant)  │    │  (JWT Tokens)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Project Structure
```
Ai-Roulette/
├── frontend/                 # React TypeScript app
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React state management
│   │   ├── hooks/           # Custom React hooks
│   │   ├── assets/          # Static assets
│   │   └── App.tsx          # Main application
│   ├── package.json         # Dependencies & scripts
│   └── vite.config.ts       # Build configuration
├── backend/                  # FastAPI Python server
│   ├── models/              # Pydantic data models
│   │   └── game.py          # Game state models
│   ├── services/            # Business logic layer
│   │   ├── ai_service.py    # AI integration
│   │   ├── auth_service.py  # Authentication
│   │   └── database.py      # Database operations
│   ├── utils/               # Utility functions
│   │   └── websocket_manager.py # Real-time updates
│   ├── main.py              # FastAPI application
│   └── requirements.txt     # Python dependencies
├── docs/                    # Project documentation
│   ├── corrected-database-schema.sql # Database setup
│   ├── AI-INTEGRATION.md    # AI system documentation
│   └── SETUP.md            # Detailed setup guide
└── README.md               # This file
```

### Key Design Decisions

**Frontend Architecture:**
- **Optimistic UI Updates**: Immediate visual feedback with backend verification
- **Context-based State**: React contexts for game state, auth, and player data
- **Component Composition**: Modular, reusable components for maintainability
- **TypeScript**: Full type safety across the application

**Backend Architecture:**
- **Service Layer Pattern**: Separation of concerns with dedicated service classes
- **Dual AI System**: Primary OpenAI integration with JavaScript/TypeScript backup parser
- **Database-First**: Supabase as single source of truth for all game data
- **RESTful API**: Clear endpoint structure with automatic OpenAPI documentation

## 🔒 Security Features

- Row Level Security (RLS) in Supabase
- JWT authentication
- Input validation and sanitization
- Rate limiting on API endpoints


## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
