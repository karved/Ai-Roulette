from supabase import create_client, Client
from typing import List, Dict, Any
from models.game import GameState, Payout
from datetime import datetime, timedelta
import os

def get_service_supabase() -> Client:
    """Get Supabase client with service role key"""
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if supabase_url and service_key:
        return create_client(supabase_url, service_key)
    else:
        raise Exception("Supabase service credentials not found")

class DatabaseService:
    """Database service using Supabase"""
    
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        if supabase_url and supabase_key:
            self.supabase: Client = create_client(supabase_url, supabase_key)
        else:
            self.supabase = None

    async def get_game_state(self, player_id: str) -> GameState:
        """Get current game state for a player"""
        try:
            if not self.supabase:
                return self._mock_game_state()
            
            # Get recent spins from game_rounds table
            recent_spins_response = self.supabase.table("game_rounds").select("winning_number, color, is_even, is_low, dozen, roulette_column, spun_at").not_.is_("winning_number", "null").order("spun_at", desc=True).limit(10).execute()
            recent_spins = []
            for spin in recent_spins_response.data:
                if spin["winning_number"] is not None:
                    recent_spins.append({
                        "winning_number": spin["winning_number"],
                        "color": spin["color"],
                        "is_even": spin["is_even"],
                        "is_low": spin["is_low"],
                        "dozen": spin["dozen"],
                        "column": spin["roulette_column"],
                        "spun_at": spin["spun_at"]
                    })
            
            # Get active bets for current round
            active_bets_response = self.supabase.table("bets").select("*").is_("is_winner", "null").execute()
            active_bets = active_bets_response.data
            
            # Get hot/cold numbers from database view
            hot_cold_numbers = await self._get_hot_cold_from_view()
            
            return GameState(
                current_round_id="current-round",
                phase="betting",
                time_remaining=30,
                total_pot=sum(bet.get("amount", 0) for bet in active_bets),
                active_bets=active_bets,
                recent_spins=recent_spins,
                hot_numbers=hot_cold_numbers.get("hot", []),
                cold_numbers=hot_cold_numbers.get("cold", []),
                player_count=await self._get_active_player_count()
            )
        except Exception:
            return self._mock_game_state()

    async def update_balances(self, payouts: List[Payout]) -> None:
        """Update player balances after payouts"""
        if not self.supabase:
            return
        
        try:
            for payout in payouts:
                # Update player balance
                self.supabase.table("players").update({
                    "balance": f"balance + {payout.amount}",
                    "total_winnings": f"total_winnings + {payout.amount}"
                }).eq("id", payout.player_id).execute()
                
                # Record payout
                self.supabase.table("payouts").insert({
                    "player_id": payout.player_id,
                    "bet_id": payout.bet_id,
                    "amount": payout.amount,
                    "round_id": payout.round_id,
                "paid_at": datetime.utcnow().isoformat()
                }).execute()
        except Exception:
            pass

    async def get_leaderboard(self) -> List[Dict[str, Any]]:
        """Get player leaderboard"""
        try:
            if not self.supabase:
                return self._mock_leaderboard()
            
            response = self.supabase.table("players").select(
                "username, total_winnings, games_played"
            ).order("total_winnings", desc=True).limit(10).execute()
            
            return response.data
        except Exception:
            return self._mock_leaderboard()

    async def get_analytics(self) -> Dict[str, Any]:
        """Get hot/cold numbers and recent statistics"""
        try:
            if not self.supabase:
                return self._mock_analytics()
            
            # Get recent spins for analysis from game_rounds
            recent_spins_response = self.supabase.table("game_rounds").select("winning_number").not_.is_("winning_number", "null").order("spun_at", desc=True).limit(100).execute()
            
            numbers = [spin["winning_number"] for spin in recent_spins_response.data]
            number_counts = {}
            
            for num in numbers:
                number_counts[num] = number_counts.get(num, 0) + 1
            
            # Sort by frequency
            sorted_numbers = sorted(number_counts.items(), key=lambda x: x[1], reverse=True)
            
            hot_numbers = [{"number": num, "count": count} for num, count in sorted_numbers[:5]]
            cold_numbers = [{"number": num, "count": count} for num, count in sorted_numbers[-5:]]
            
            return {
                "hot_numbers": hot_numbers,
                "cold_numbers": cold_numbers,
                "total_spins": len(numbers),
                "last_updated": datetime.utcnow().isoformat()
            }
        except Exception:
            return self._mock_analytics()

    async def save_spin_result(self, round_id: str, winning_number: int, color: str, is_even: bool, is_low: bool, dozen: int, column: int) -> None:
        """Save spin result to game_rounds table"""
        if not self.supabase:
            return
        
        try:
            self.supabase.table("game_rounds").update({
                "winning_number": winning_number,
                "color": color,
                "is_even": is_even,
                "is_low": is_low,
                "dozen": dozen,
                "roulette_column": column,
                "spun_at": datetime.utcnow().isoformat(),
                "phase": "completed"
            }).eq("id", round_id).execute()
        except Exception:
            pass

    async def save_bet(self, player_id: str, round_id: str, bet_type: str, bet_data: dict, amount: float, potential_payout: float) -> None:
        """Save bet to database"""
        if not self.supabase:
            return
        
        try:
            self.supabase.table("bets").insert({
                "player_id": player_id,
                "round_id": round_id,
                "bet_type": bet_type,
                "bet_data": bet_data,
                "amount": amount,
                "potential_payout": potential_payout,
                "placed_at": datetime.utcnow().isoformat()
            }).execute()
        except Exception:
            pass

    async def _get_hot_cold_from_view(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get hot and cold numbers from database view"""
        if not self.supabase:
            return {"hot": [], "cold": []}
        
        try:
            # Use the hot_cold_numbers view from the database schema
            response = self.supabase.table("hot_cold_numbers").select("*").execute()
            
            hot_numbers = []
            cold_numbers = []
            
            for row in response.data:
                number_data = {
                    "number": row["winning_number"],
                    "count": row["hit_count"]
                }
                
                if row["temperature"] == "hot":
                    hot_numbers.append(number_data)
                elif row["temperature"] == "cold":
                    cold_numbers.append(number_data)
            
            return {
                "hot": hot_numbers,
                "cold": cold_numbers
            }
        except Exception:
            return {"hot": [], "cold": []}

    async def _get_active_player_count(self) -> int:
        """Get count of active players"""
        if not self.supabase:
            return 1
        
        try:
            # Count players active in last 5 minutes
            cutoff_time = datetime.utcnow() - timedelta(minutes=5)
            response = self.supabase.table("players").select("id").gte("last_active", cutoff_time.isoformat()).execute()
            return len(response.data)
        except Exception:
            return 1

    def _mock_game_state(self) -> GameState:
        """Mock game state for development"""
        return GameState(
            current_round_id="mock-round-1",
            phase="betting",
            time_remaining=25,
            total_pot=150.0,
            active_bets=[],
            recent_spins=[],
            hot_numbers=[{"number": 7, "count": 5}, {"number": 23, "count": 4}],
            cold_numbers=[{"number": 13, "count": 1}, {"number": 2, "count": 1}],
            player_count=3
        )

    def _mock_leaderboard(self) -> List[Dict[str, Any]]:
        """Mock leaderboard for development"""
        return [
            {"username": "Player1", "total_winnings": 250.0, "games_played": 15},
            {"username": "Player2", "total_winnings": 180.0, "games_played": 12},
            {"username": "Player3", "total_winnings": 120.0, "games_played": 8}
        ]

    def _mock_analytics(self) -> Dict[str, Any]:
        """Mock analytics for development"""
        return {
            "hot_numbers": [{"number": 7, "count": 8}, {"number": 23, "count": 6}],
            "cold_numbers": [{"number": 13, "count": 1}, {"number": 2, "count": 2}],
            "total_spins": 50,
            "last_updated": datetime.utcnow().isoformat()
        }
