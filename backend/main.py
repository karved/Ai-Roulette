from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import asyncio
from datetime import datetime
import os
from dotenv import load_dotenv

from models.game import GameState, Bet, SpinResult, Player
from services.roulette_engine import RouletteEngine
from services.auth_service import AuthService
from services.database import DatabaseService
from services.ai_service import AIService
from utils.websocket_manager import WebSocketManager

load_dotenv()

app = FastAPI(
    title="AI Roulette API",
    description="Backend API for AI-powered multiplayer roulette game",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://ai-roulette.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
auth_service = AuthService()
db_service = DatabaseService()
roulette_engine = RouletteEngine()
ai_service = AIService()
websocket_manager = WebSocketManager()

# Security
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return current user"""
    return await auth_service.verify_token(credentials.credentials)

# API Routes
@app.get("/")
async def root():
    return {"message": "AI Roulette API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.post("/auth/login")
async def login(credentials: dict):
    """User login endpoint"""
    return await auth_service.login(credentials["email"], credentials["password"])

@app.post("/auth/register")
async def register(user_data: dict):
    """User registration endpoint"""
    return await auth_service.register(user_data)

@app.get("/game-state")
async def get_game_state(current_user: Player = Depends(get_current_user)):
    """Get current game state for authenticated user"""
    return await db_service.get_game_state(current_user.id)

@app.post("/bets")
async def place_bet(bet_data: dict, current_user: Player = Depends(get_current_user)):
    """Place a bet in the current round"""
    bet = Bet(**bet_data, player_id=current_user.id)
    result = await roulette_engine.place_bet(bet)
    
    # Broadcast bet to all connected clients
    await websocket_manager.broadcast_bet(bet)
    
    return result

@app.post("/spin")
async def spin_wheel(current_user: Player = Depends(get_current_user)):
    """Initiate roulette wheel spin"""
    spin_result = await roulette_engine.spin()
    
    # Calculate payouts for all bets
    payouts = await roulette_engine.calculate_payouts(spin_result)
    
    # Update player balances
    await db_service.update_balances(payouts)
    
    # Broadcast spin result to all clients
    await websocket_manager.broadcast_spin_result(spin_result)
    
    return spin_result

@app.get("/leaderboard")
async def get_leaderboard():
    """Get current leaderboard"""
    return await db_service.get_leaderboard()

@app.get("/analytics")
async def get_analytics():
    """Get hot/cold numbers and recent rolls"""
    return await db_service.get_analytics()

@app.post("/ai/chat")
async def chat_with_ai(message: dict, current_user: Player = Depends(get_current_user)):
    """Chat with AI assistant"""
    response = await ai_service.process_message(message["text"], current_user)
    return {"response": response}

@app.post("/ai/parse-bet")
async def parse_bet_command(command: dict, current_user: Player = Depends(get_current_user)):
    """Parse natural language betting command"""
    parsed_bet = await ai_service.parse_bet_command(command["text"])
    return parsed_bet

# WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket_manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message["type"] == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message["type"] == "bet":
                # Process bet through WebSocket
                pass
                
    except WebSocketDisconnect:
        websocket_manager.disconnect(client_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
