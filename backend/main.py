from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
import os
import json
import logging
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

from services.ai_service import AIService
from services.auth_service import AuthService
from utils.websocket_manager import WebSocketManager

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create a separate logger for API requests
api_logger = logging.getLogger("api_requests")
api_logger.setLevel(logging.INFO)

app = FastAPI(
    title="AI Roulette API",
    description="Backend API for AI-powered roulette game with Supabase integration",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Request Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log the incoming request
    api_logger.info(f"🔵 {request.method} {request.url.path} - Client: {request.client.host if request.client else 'unknown'}")
    
    # Log query parameters if any
    if request.query_params:
        api_logger.info(f"   Query params: {dict(request.query_params)}")
    
    # Process the request
    response = await call_next(request)
    
    # Calculate processing time
    process_time = time.time() - start_time
    
    # Log the response
    status_emoji = "🟢" if response.status_code < 400 else "🔴" if response.status_code >= 500 else "🟡"
    api_logger.info(f"{status_emoji} {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.3f}s")
    
    return response

# Supabase clients
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")  # For admin operations
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")  # For user operations with RLS

if not supabase_url or not supabase_service_key or not supabase_anon_key:
    raise ValueError("SUPABASE_URL, SUPABASE_SERVICE_KEY, and SUPABASE_ANON_KEY must be set")

# Admin client for auth operations
supabase_admin: Client = create_client(supabase_url, supabase_service_key)
# User client for RLS-protected operations
supabase: Client = create_client(supabase_url, supabase_anon_key)

# Services
ai_service = AIService()
auth_service = AuthService()
websocket_manager = WebSocketManager()

# Authentication dependency
async def get_current_user_and_token(authorization: str = Header(None)):
    """Extract and verify JWT token from Authorization header, return both user and token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token required")
    
    try:
        token = authorization.split(" ")[1]
        player = await auth_service.verify_token(token)
        if not player:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return player, token
    except IndexError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    except Exception:
        raise HTTPException(status_code=500, detail="Token validation failed")

async def get_current_user(authorization: str = Header(None)):
    """Extract and verify JWT token from Authorization header"""
    player, _ = await get_current_user_and_token(authorization)
    return player

def get_user_supabase_client(token: str) -> Client:
    """Get Supabase client with user token for RLS-protected operations"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_anon_key:
        raise ValueError("Supabase credentials not found")
    
    client = create_client(supabase_url, supabase_anon_key)
    # Set the authorization header for the user session
    client.auth.set_session(token, "")
    return client

# API Routes
@app.get("/")
async def root():
    return {"message": "AI Roulette API is running"}

@app.post("/debug/reset-balance")
async def reset_balance(current_user = Depends(get_current_user)):
    """Debug endpoint to reset player balance to 100"""
    try:
        supabase_admin.table("players").update({
            "balance": 100.0,
            "total_winnings": 0.0,
            "games_played": 0
        }).eq("id", current_user.id).execute()
        return {"message": "Balance reset to $100"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# @app.get("/analytics/hot-cold")
# async def get_hot_cold_numbers(current_user = Depends(get_current_user)):
#     """Get hot and cold numbers from Supabase - DISABLED: Not used in frontend"""
#     return {"hot": [], "cold": []}

@app.post("/ai/chat")
async def ai_chat(request: Dict[str, Any], current_user = Depends(get_current_user)):
    """Chat with AI assistant"""
    try:
        message = request.get("text", "")
        if not message or len(message.strip()) == 0:
            raise HTTPException(status_code=400, detail="Message text is required")
        
        if len(message) > 1000:
            raise HTTPException(status_code=400, detail="Message too long (max 1000 characters)")
        
        response = await ai_service.process_message(message, current_user)
        return {"response": response}
    except HTTPException:
        raise
    except Exception:
        return {"response": "I'm here to help with roulette strategies and betting advice. What would you like to know?"}

@app.post("/ai/parse-bet")
async def parse_bet_command(request: Dict[str, Any], current_user = Depends(get_current_user)):
    """Parse natural language betting commands"""
    try:
        command = request.get("text", "")
        if not command or len(command.strip()) == 0:
            raise HTTPException(status_code=400, detail="Command text is required")
        
        if len(command) > 500:
            raise HTTPException(status_code=400, detail="Command too long (max 500 characters)")
        
        result = await ai_service.parse_bet_command(command, current_user)
        return result
    except HTTPException:
        raise
    except Exception:
        return {
            "success": False,
            "error": "Could not parse betting command",
            "suggestion": "Try commands like 'bet $10 on red' or 'place 5 on number 7'"
        }

@app.post("/auth/login")
async def login(request: Dict[str, Any]):
    """User login with Supabase Auth"""
    try:
        email = request.get("email")
        password = request.get("password")
        
        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")
        
        result = await auth_service.login(email, password)
        
        if "error" in result:
            raise HTTPException(status_code=401, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@app.post("/auth/register")
async def register(request: Dict[str, Any]):
    """User registration with Supabase Auth"""
    try:
        email = request.get("email")
        password = request.get("password")
        username = request.get("username")
        
        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")
        
        user_data = {
            "email": email,
            "password": password,
            "username": username
        }
        
        result = await auth_service.register(user_data)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.get("/auth/verify")
async def verify_token(token: str):
    """Verify JWT token and return user info"""
    try:
        player = await auth_service.verify_token(token)
        
        if not player:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return {
            "user": {
                "id": player.id,
                "email": player.email,
                "username": player.username,
                "balance": player.balance,
                "total_winnings": player.total_winnings,
                "games_played": player.games_played
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token verification failed: {str(e)}")

@app.get("/player/stats")
async def get_player_stats(current_user = Depends(get_current_user)):
    """Get detailed player statistics"""
    try:
        # Use admin client for stats aggregation
        service_client = supabase_admin
        
        # Re-fetch latest player row to ensure freshness
        player_resp = service_client.from_("players").select("balance, games_played").eq("id", current_user.id).single().execute()
        latest_balance = player_resp.data["balance"] if player_resp.data else current_user.balance
        latest_games_played = player_resp.data["games_played"] if player_resp.data else current_user.games_played
        
        # Only include processed bets (is_winner is not null)
        processed_bets = service_client.from_("bets").select("amount, actual_payout, is_winner").eq("player_id", current_user.id).not_.is_("is_winner", "null").execute()
        bets = processed_bets.data or []
        
        total_wagered = sum(b["amount"] for b in bets)
        total_payout = sum((b.get("actual_payout") or 0) for b in bets)
        net_profit = total_payout - total_wagered
        total_bets = len(bets)
        
        # Win rate: (number of winning bets / total bets) * 100 - 0 is baseline
        winning_bets_count = sum(1 for b in bets if b.get("is_winner"))
        win_rate = (winning_bets_count / total_bets * 100) if total_bets > 0 else 0
        
        stats = {
            "balance": latest_balance,
            "totalWon": net_profit,  # Net profit across processed bets
            "totalWagered": total_wagered,
            "totalBets": total_bets,
            "games_played": latest_games_played,
            "win_rate": round(win_rate, 2),
            "net_result": net_profit
        }
        
        return stats
    except Exception as e:
        logger.error(f"Stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unable to fetch player stats: {str(e)}")

# Game endpoints
@app.get("/game-state")
async def get_game_state(user_data = Depends(get_current_user_and_token)):
    """Get current game state"""
    try:
        current_user, token = user_data
        
        
        # Use service client for cross-user data (admin-level queries)
        service_client = supabase_admin
        
        # Use user client for user-specific data
        user_client = get_user_supabase_client(token)
        
        # Get current round (cross-user data - use service client)
        rounds_response = service_client.from_("game_rounds").select("*").eq("phase", "betting").limit(1).execute()
        current_round = rounds_response.data[0] if rounds_response.data else None
        
        # Get recent spins (cross-user data - use service client)
        spins_response = service_client.from_("game_rounds").select("winning_number, color, spun_at").not_.is_("winning_number", "null").order("spun_at", desc=True).limit(10).execute()
        
        # Get active player count (cross-user data - use service client)
        players_response = service_client.from_("players").select("id").gte("last_active", (datetime.utcnow() - timedelta(minutes=5)).isoformat()).execute()
        
        # Get user's active bets (user-specific data - use user client)
        bets_response = user_client.from_("bets").select("*").eq("player_id", current_user.id).is_("is_winner", "null").execute()
        
        game_state = {
            "phase": current_round["phase"] if current_round else "betting",
            "time_remaining": 30,
            "player_balance": current_user.balance,
            "active_bets": len(bets_response.data),
            "recent_spins": [{
                "winning_number": spin["winning_number"],
                "color": spin["color"],
                "timestamp": spin["spun_at"]
            } for spin in spins_response.data],
            "player_count": len(players_response.data)
        }
        
        
        return game_state
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to fetch game state: {str(e)}")

@app.post("/game/reset-phase")
async def reset_phase(current_user = Depends(get_current_user)):
    """Reset game phase - Admin only"""
    # In a real app, you'd check for admin role here
    try:
        # Create new round
        # Get the next round number
        max_round_response = supabase_admin.from_("game_rounds").select("round_number").order("round_number", desc=True).limit(1).execute()
        next_round_number = (max_round_response.data[0]["round_number"] + 1) if max_round_response.data else 1
        
        new_round = supabase_admin.from_("game_rounds").insert({
            "phase": "betting",
            "round_number": next_round_number
        }).execute()
        return {"message": "Game phase reset to betting", "round_id": new_round.data[0]["id"] if new_round.data else None}
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to reset game phase")

@app.post("/ai/analyze-pattern")
async def analyze_pattern(user_data = Depends(get_current_user_and_token)):
    """Analyze betting patterns"""
    try:
        current_user, token = user_data
        # Use user token for RLS - user can only see their own bets
        user_client = get_user_supabase_client(token)
        
        # Get user's betting history
        bets_response = user_client.from_("bets").select("*").eq("player_id", current_user.id).order("placed_at", desc=True).limit(50).execute()
        
        if len(bets_response.data) < 5:
            return {"summary": "Not enough betting data yet. Place more bets to see patterns!"}
        
        # Simple pattern analysis
        bet_types = [bet["bet_type"] for bet in bets_response.data]
        most_common = max(set(bet_types), key=bet_types.count)
        
        return {
            "summary": f"You tend to favor {most_common} bets. Total bets analyzed: {len(bets_response.data)}",
            "most_common_bet": most_common,
            "total_bets": len(bets_response.data)
        }
    except Exception:
        return {"summary": "Unable to analyze patterns at this time. Try again later."}

@app.post("/game/place-bet")
async def place_bet(request: Dict[str, Any], user_data = Depends(get_current_user_and_token)):
    """Place a bet in the game"""
    try:
        current_user, token = user_data
        bet_type = request.get("bet_type")
        amount = request.get("amount")
        numbers = request.get("numbers", [])
        
        
        # Input validation
        if not bet_type or amount is None:
            raise HTTPException(status_code=400, detail="bet_type and amount are required")
        
        if not isinstance(amount, (int, float)) or amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be a positive number")
        
        if amount > 1000:
            raise HTTPException(status_code=400, detail="Maximum bet amount is $1000")
        
        if current_user.balance < amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        valid_bet_types = ["straight", "split", "street", "corner", "line", "dozen", "column", "red", "black", "even", "odd", "low", "high"]
        if bet_type not in valid_bet_types:
            raise HTTPException(status_code=400, detail="Invalid bet type")
        
        # Calculate potential winnings based on bet type (not including original bet)
        payout_multipliers = {
            "straight": 35, "split": 17, "street": 11, "corner": 8, "line": 5,
            "dozen": 2, "column": 2, "red": 1, "black": 1, "even": 1, "odd": 1, "low": 1, "high": 1
        }
        
        multiplier = payout_multipliers.get(bet_type, 1)
        potential_winnings = amount * multiplier  # Pure winnings, not including bet return
        
        # Use user token for RLS - user can only update their own balance
        user_client = get_user_supabase_client(token)
        service_client = supabase_admin
        
        # Get or create current round for bet association
        service_client = supabase_admin
        rounds_response = service_client.from_("game_rounds").select("id").eq("phase", "betting").limit(1).execute()
        if rounds_response.data:
            round_id = rounds_response.data[0]["id"]
        else:
            # Get next round number and create new round
            max_round_response = service_client.from_("game_rounds").select("round_number").order("round_number", desc=True).limit(1).execute()
            next_round_number = (max_round_response.data[0]["round_number"] + 1) if max_round_response.data else 1
            
            # Get main lobby ID
            lobby_response = service_client.from_("game_lobbies").select("id").eq("name", "Main Lobby").single().execute()
            lobby_id = lobby_response.data["id"] if lobby_response.data else None
            
            new_round = service_client.from_("game_rounds").insert({
                "phase": "betting",
                "round_number": next_round_number,
                "lobby_id": lobby_id
            }).execute()
            round_id = new_round.data[0]["id"] if new_round.data else None
            
        if not round_id:
            raise HTTPException(status_code=500, detail="Could not create or find active round")
        
        # Calculate payout odds
        payout_odds = potential_winnings / amount if amount > 0 else 0
        
        # Re-fetch latest balance to avoid stale reads and race conditions
        latest_bal_resp = user_client.table("players").select("balance").eq("id", current_user.id).single().execute()
        latest_balance = latest_bal_resp.data["balance"] if latest_bal_resp.data else current_user.balance
        if latest_balance < amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        new_balance = latest_balance - amount
        
        # Deduct balance first
        user_client.table("players").update({"balance": new_balance}).eq("id", current_user.id).execute()
        
        # Prepare bet data
        bet_data = {
            "player_id": current_user.id,
            "round_id": round_id,
            "bet_type": bet_type,
            "bet_data": {"numbers": numbers},
            "amount": amount,
            "potential_payout": potential_winnings,
            "payout_odds": payout_odds
        }
        
        # Insert bet; on failure rollback the balance deduction
        try:
            bet_result = user_client.table("bets").insert(bet_data).execute()
        except Exception as e:
            user_client.table("players").update({"balance": latest_balance}).eq("id", current_user.id).execute()
            raise HTTPException(status_code=500, detail=f"Bet could not be placed: {str(e)}")
        
        bet_id = bet_result.data[0]["id"] if bet_result.data else "unknown"
        
        return {
            "success": True,
            "bet_id": bet_id,
            "potential_payout": potential_winnings,
            "new_balance": new_balance
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bet placement error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error placing bet: {str(e)}")

# ... (rest of the code remains the same)

@app.post("/game/get-winning-number")
async def get_winning_number(user_data = Depends(get_current_user_and_token)):
    """Get random winning number for wheel animation"""
    try:
        import random
        
        # Generate random winning number (0-36)
        winning_number = random.randint(0, 36)
        
        # Determine color and properties
        if winning_number == 0:
            color = "green"
        elif winning_number in [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]:
            color = "red"
        else:
            color = "black"
            
        is_even = winning_number % 2 == 0 and winning_number != 0
        is_low = 1 <= winning_number <= 18
        dozen = (winning_number - 1) // 12 + 1 if winning_number > 0 else 0
        column = winning_number % 3 if winning_number % 3 != 0 else 3 if winning_number > 0 else 0
        
        return {
            "winning_number": winning_number,
            "color": color,
            "is_even": is_even,
            "is_low": is_low,
            "dozen": dozen,
            "column": column
        }
        
    except Exception as e:
        print(f"Error generating winning number: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate winning number: {str(e)}")

@app.post("/game/spin")
async def spin_wheel(request: Dict[str, Any], user_data = Depends(get_current_user_and_token)):
    """Spin the roulette wheel with frontend bet data and calculate complete results"""
    try:
        current_user, token = user_data
        import random
        
        # Get frontend data
        initial_balance = request.get("balance", current_user.balance)  # This is the initial balance before betting
        frontend_bets = request.get("bets", [])
        animation_winning_number = request.get("winning_number")  # Use animation number if provided
        
        if not frontend_bets:
            raise HTTPException(status_code=400, detail="No bets provided for spin")
        
        # Use animation winning number if provided, otherwise generate new one
        if animation_winning_number is not None:
            winning_number = animation_winning_number
            print(f"Using animation winning number: {winning_number}")
        else:
            winning_number = random.randint(0, 36)
            print(f"Generated new winning number: {winning_number}")
        
        # Determine color and properties
        if winning_number == 0:
            color = "green"
        elif winning_number in [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]:
            color = "red"
        else:
            color = "black"
            
        is_even = winning_number % 2 == 0 and winning_number != 0
        is_low = 1 <= winning_number <= 18
        dozen = (winning_number - 1) // 12 + 1 if winning_number > 0 else 0
        column = winning_number % 3 if winning_number % 3 != 0 else 3 if winning_number > 0 else 0
        
        # Use user token for RLS
        user_client = get_user_supabase_client(token)
        service_client = supabase_admin
        
        total_wagered = 0
        total_won = 0
        winning_bets = 0
        total_bets = len(frontend_bets)
        payouts = []
        
        # Calculate odds based on bet type (backend authoritative)
        def get_payout_odds(bet_type: str) -> int:
            payout_multipliers = {
                "straight": 35, "split": 17, "street": 11, "corner": 8, "line": 5,
                "dozen": 2, "column": 2, "red": 1, "black": 1, "even": 1, "odd": 1, "low": 1, "high": 1
            }
            return payout_multipliers.get(bet_type, 1)
        
        # Process each frontend bet with backend-calculated odds
        for bet in frontend_bets:
            bet_amount = bet.get("amount", 0)
            bet_type = bet.get("betType", "")
            bet_numbers = bet.get("numbers", [])
            
            # Backend calculates potential payout based on bet type (winnings only)
            odds_multiplier = get_payout_odds(bet_type)
            potential_winnings = bet_amount * odds_multiplier  # Pure winnings
            
            total_wagered += bet_amount
            is_winner = False
            actual_payout = 0
            
            # Complete bet type checking
            if bet_type == "straight":
                is_winner = winning_number in bet_numbers
            elif bet_type == "split":
                is_winner = winning_number in bet_numbers
            elif bet_type == "street":
                is_winner = winning_number in bet_numbers
            elif bet_type == "corner":
                is_winner = winning_number in bet_numbers
            elif bet_type == "line":
                is_winner = winning_number in bet_numbers
            elif bet_type == "dozen":
                is_winner = dozen in bet_numbers
            elif bet_type == "column":
                is_winner = column in bet_numbers
            elif bet_type == "red":
                is_winner = color == "red"
            elif bet_type == "black":
                is_winner = color == "black"
            elif bet_type == "even":
                is_winner = is_even
            elif bet_type == "odd":
                is_winner = not is_even and winning_number != 0
            elif bet_type == "low":
                is_winner = is_low
            elif bet_type == "high":
                is_winner = not is_low and winning_number != 0
            
            if is_winner:
                winning_bets += 1
                actual_payout = bet_amount + potential_winnings  # Return original bet + winnings
                total_won += actual_payout
                logger.info(f"WINNING BET: type={bet_type}, amount=${bet_amount}, winnings=${potential_winnings}, total_payout=${actual_payout}")
                payouts.append({
                    "amount": actual_payout,
                    "bet_type": bet_type,
                    "bet_amount": bet_amount,
                    "winnings": potential_winnings
                })
        
        # Calculate net result (profit/loss) - this is what gets added to totals
        net_result = total_won - total_wagered
        logger.info(f"NET CALCULATION: total_won=${total_won} - total_wagered=${total_wagered} = net_result=${net_result}")
        
        # Calculate new balance: initial balance + net result
        new_balance = initial_balance + net_result
        logger.info(f"BALANCE CALCULATION: initial_balance=${initial_balance} + net_result=${net_result} = new_balance=${new_balance}")
        
        # Re-fetch current player stats for accurate calculations
        latest_stats_resp = user_client.table("players").select("balance, total_winnings, games_played, total_wagered, total_bets").eq("id", current_user.id).single().execute()
        current_stats = latest_stats_resp.data if latest_stats_resp.data else {}
        
        # Win rate will be calculated after bet insertion to include current round
        
        # Update player with new balance and cumulative stats
        current_total_winnings = current_stats.get("total_winnings", 0)
        current_total_wagered = current_stats.get("total_wagered", 0)
        current_games_played = current_stats.get("games_played", 0)
        
        # Update database with: initial_balance + net, add wagered to total, add net to total net
        user_client.table("players").update({
            "balance": new_balance,  # initial_balance + net_result
            "total_winnings": current_total_winnings + net_result,  # Add this round's net to total
            "total_wagered": current_total_wagered + total_wagered,  # Add this round's wagered to total
            "games_played": current_games_played + 1
        }).eq("id", current_user.id).execute()
        
        # Get or create current round for bet storage
        rounds_response = service_client.from_("game_rounds").select("id").eq("phase", "betting").limit(1).execute()
        if rounds_response.data:
            round_id = rounds_response.data[0]["id"]
        else:
            # Get next round number and create new round
            max_round_response = service_client.from_("game_rounds").select("round_number").order("round_number", desc=True).limit(1).execute()
            next_round_number = (max_round_response.data[0]["round_number"] + 1) if max_round_response.data else 1
            
            # Get main lobby ID
            lobby_response = service_client.from_("game_lobbies").select("id").eq("name", "Main Lobby").single().execute()
            lobby_id = lobby_response.data["id"] if lobby_response.data else None
            
            new_round = service_client.from_("game_rounds").insert({
                "phase": "betting",
                "round_number": next_round_number,
                "lobby_id": lobby_id
            }).execute()
            round_id = new_round.data[0]["id"] if new_round.data else None

        # Store bets in database for record keeping with proper winner determination
        payout_index = 0
        for bet in frontend_bets:
            bet_amount = bet.get("amount", 0)
            bet_type = bet.get("betType", "")
            bet_numbers = bet.get("numbers", [])
            
            # Backend calculates potential payout (consistent with processing above)
            odds_multiplier = get_payout_odds(bet_type)
            potential_winnings = bet_amount * odds_multiplier  # Pure winnings
            
            # Re-determine if this specific bet is a winner
            is_winner = False
            actual_payout = 0
            
            if bet_type == "straight":
                is_winner = winning_number in bet_numbers
            elif bet_type == "split":
                is_winner = winning_number in bet_numbers
            elif bet_type == "street":
                is_winner = winning_number in bet_numbers
            elif bet_type == "corner":
                is_winner = winning_number in bet_numbers
            elif bet_type == "line":
                is_winner = winning_number in bet_numbers
            elif bet_type == "dozen":
                is_winner = dozen in bet_numbers
            elif bet_type == "column":
                is_winner = column in bet_numbers
            elif bet_type == "red":
                is_winner = color == "red"
            elif bet_type == "black":
                is_winner = color == "black"
            elif bet_type == "even":
                is_winner = is_even
            elif bet_type == "odd":
                is_winner = not is_even and winning_number != 0
            elif bet_type == "low":
                is_winner = is_low
            elif bet_type == "high":
                is_winner = not is_low and winning_number != 0
            
            if is_winner:
                actual_payout = payouts[payout_index]["amount"] if payout_index < len(payouts) else bet_amount + potential_winnings
                payout_index += 1
            
            user_client.table("bets").insert({
                "player_id": current_user.id,
                "round_id": round_id,
                "bet_type": bet_type,
                "bet_data": {"numbers": bet_numbers},
                "amount": bet_amount,
                "potential_payout": potential_winnings,  # Store pure winnings
                "payout_odds": odds_multiplier,
                "is_winner": is_winner,
                "actual_payout": actual_payout,  # Store total payout (bet + winnings)
                "processed_at": datetime.utcnow().isoformat()
            }).execute()
        
        # Calculate win rate AFTER bet insertion to include current round
        all_bets_resp = user_client.table("bets").select("is_winner").eq("player_id", current_user.id).not_.is_("is_winner", "null").execute()
        all_processed_bets = all_bets_resp.data or []
        
        # Calculate win rate: (winning bets / total bets) * 100
        total_processed_bets = len(all_processed_bets)
        total_winning_bets = sum(1 for bet in all_processed_bets if bet["is_winner"])
        win_rate = (total_winning_bets / total_processed_bets * 100) if total_processed_bets > 0 else 0
        
        logger.info(f"SPIN DEBUG: winning_number={winning_number}, initial_balance=${initial_balance}")
        logger.info(f"SPIN DEBUG: total_wagered=${total_wagered}, total_won=${total_won}, winning_bets={winning_bets}/{total_bets}")
        logger.info(f"SPIN DEBUG: net_result=${net_result}, new_balance=${new_balance}, win_rate={win_rate:.2f}%")
        logger.info(f"SPIN DEBUG: payouts={payouts}")
        logger.info(f"WIN RATE DEBUG: total_winning_bets={total_winning_bets}, total_processed_bets={total_processed_bets}")
        
        return {
            "winning_number": winning_number,
            "color": color,
            "is_even": is_even,
            "is_low": is_low,
            "dozen": dozen,
            "column": column,
            "payouts": payouts,
            "total_wagered": total_wagered,
            "total_won": total_won,
            "net_result": net_result,
            "new_balance": new_balance,
            "win_rate": round(win_rate, 2),
            "winning_bets": winning_bets,
            "total_bets": total_bets
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Spin error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error spinning wheel: {str(e)}")

# WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time game updates"""
    await websocket_manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message.get("type") == "get_game_state":
                # Get real game state from database
                try:
                    # Use service client to bypass RLS
                    service_client = supabase_admin
                    
                    # Get current round
                    rounds_response = service_client.table("game_rounds").select("*").eq("phase", "betting").limit(1).execute()
                    current_round = rounds_response.data[0] if rounds_response.data else None
                    
                    # Get recent spins
                    spins_response = service_client.table("game_rounds").select("winning_number, color, spun_at").not_.is_("winning_number", "null").order("spun_at", desc=True).limit(10).execute()
                    
                    # Get active player count
                    players_response = service_client.table("players").select("id").gte("last_active", (datetime.utcnow() - timedelta(minutes=5)).isoformat()).execute()
                    
                    game_state = {
                        "type": "game_state",
                        "data": {
                            "phase": current_round["phase"] if current_round else "betting",
                            "time_remaining": 30,  # Calculate from betting_ends_at
                            "player_count": len(players_response.data),
                            "recent_spins": [{
                                "winning_number": spin["winning_number"],
                                "color": spin["color"],
                                "timestamp": spin["spun_at"]
                            } for spin in spins_response.data]
                        }
                    }
                    await websocket.send_text(json.dumps(game_state))
                except Exception:
                    # Fallback to basic state
                    await websocket.send_text(json.dumps({
                        "type": "game_state",
                        "data": {"phase": "betting", "time_remaining": 30, "player_count": 1, "recent_spins": []}
                    }))
            
    except WebSocketDisconnect:
        websocket_manager.disconnect(client_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
