# AI Integration Documentation

## Overview

The AI-Roulette application uses a **dual-layer AI system** with OpenAI as the primary service and a backup JavaScript/TypeScript parser for reliability.

## AI Architecture

### Primary AI Service (OpenAI)
- **Service**: OpenAI GPT-3.5-turbo
- **Purpose**: Natural language processing for chat and bet parsing
- **Location**: `backend/services/ai_service.py`
- **Features**:
  - Intelligent chat responses about roulette strategies
  - Natural language bet command parsing
  - Context-aware responses based on player data

### Backup Parser (JavaScript/TypeScript)
- **Service**: Regex-based pattern matching
- **Purpose**: Fallback when OpenAI API is unavailable
- **Locations**: 
  - **Frontend**: `frontend/src/components/IntegratedAssistant.tsx` (parseBetCommand, parseRemoveCommand functions)
  - **Backend**: `backend/services/ai_service.py` (BackupBetParser class)
- **Features**:
  - Regex patterns for common betting commands
  - No external API dependency
  - Reliable basic parsing functionality
  - Dual implementation ensures reliability

## Required API Keys

### OpenAI API Key (Optional but Recommended)
```bash
# Backend (.env)
OPENAI_API_KEY=your_openai_api_key_here

# Frontend (.env.local) - Optional for client-side features
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

**How to get OpenAI API Key:**
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create account or sign in
3. Go to API Keys section
4. Create new API key
5. Copy and paste into environment files

**Cost**: Pay-per-use, typically $0.002 per 1K tokens for GPT-3.5-turbo

### Supabase Keys (Required)
```bash
# Backend (.env)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Frontend (.env.local)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## AI Features

### 1. Chat Assistant
- **Endpoint**: `POST /ai/chat`
- **Function**: Provides roulette strategy advice, explains rules, discusses odds
- **Fallback**: Rule-based responses for common questions

### 2. Bet Command Parsing
- **Endpoint**: `POST /ai/parse-bet`
- **Function**: Converts natural language to structured bet commands
- **Examples**:
  - "bet $10 on red" → `{bet_type: "red", amount: 10}`
  - "place 5 on number 7" → `{bet_type: "straight", numbers: [7], amount: 5}`
- **Fallback**: Regex-based parsing for common patterns

### 3. Voice Integration (Frontend)
- **Technology**: Web Speech API
- **Function**: Speech-to-text for voice betting commands
- **Process**: Voice → Text → AI Parser → Bet Command

## Backup System Reliability

The application is designed to **never fail** due to AI service issues:

1. **OpenAI Available**: Full AI features with intelligent responses
2. **OpenAI Unavailable**: Automatic fallback to:
   - Rule-based chat responses
   - Regex-based bet parsing
   - Basic functionality maintained

## Testing AI Integration

### Test Chat Feature
```bash
curl -X POST http://localhost:8000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"text": "What are the odds for red?"}'
```

### Test Bet Parsing
```bash
curl -X POST http://localhost:8000/ai/parse-bet \
  -H "Content-Type: application/json" \
  -d '{"text": "bet 10 on red"}'
```

## Configuration Notes

- **OpenAI API Key is OPTIONAL** - app works without it
- **Backup parser handles common betting patterns**
- **All AI features degrade gracefully**
- **No user-facing errors if OpenAI is down**

## Security Considerations

- API keys stored in environment variables only
- No API keys exposed in frontend code
- Service key used only in backend
- Anon key safe for frontend use

## Troubleshooting

### OpenAI API Issues
- Check API key validity
- Verify account has credits
- Monitor rate limits
- Fallback parser will activate automatically

### Backup Parser Issues
- Check regex patterns in `BackupBetParser`
- Verify bet command format
- Test with simple commands first

## Future Enhancements

- Add more sophisticated betting pattern recognition
- Implement player behavior analysis
- Add multilingual support
- Integrate with more AI providers for redundancy
