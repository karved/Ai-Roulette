from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class BetType(str, Enum):
    STRAIGHT = "straight"  # Single number
    SPLIT = "split"        # Two adjacent numbers
    STREET = "street"      # Three numbers in a row
    CORNER = "corner"      # Four numbers in a square
    LINE = "line"          # Six numbers in two rows
    DOZEN = "dozen"        # 1st, 2nd, or 3rd dozen
    COLUMN = "column"      # Column bet
    RED = "red"            # Red numbers
    BLACK = "black"        # Black numbers
    EVEN = "even"          # Even numbers
    ODD = "odd"            # Odd numbers
    LOW = "low"            # 1-18
    HIGH = "high"          # 19-36

class Player(BaseModel):
    id: str
    email: str
    username: str
    balance: float = 100.0
    total_winnings: float = 0.0
    games_played: int = 0
    created_at: datetime
    last_active: datetime

class Bet(BaseModel):
    id: Optional[str] = None
    player_id: str
    round_id: str
    bet_type: BetType
    numbers: List[int]  # Numbers being bet on
    amount: float
    potential_payout: float
    placed_at: datetime = datetime.utcnow()

class SpinResult(BaseModel):
    id: str
    round_id: str
    winning_number: int
    color: str  # "red", "black", "green"
    is_even: bool
    is_low: bool  # 1-18
    dozen: int    # 1, 2, or 3
    column: int   # 1, 2, or 3
    spun_at: datetime = datetime.utcnow()

class GameState(BaseModel):
    current_round_id: str
    phase: str  # "betting", "spinning", "results"
    time_remaining: int  # seconds
    total_pot: float
    active_bets: List[Bet]
    recent_spins: List[SpinResult]
    hot_numbers: List[Dict[str, Any]]  # Most frequent numbers
    cold_numbers: List[Dict[str, Any]]  # Least frequent numbers
    player_count: int

class Payout(BaseModel):
    player_id: str
    bet_id: str
    amount: float
    winning_numbers: List[int]

class ChatMessage(BaseModel):
    id: str
    player_id: str
    message: str
    response: str
    timestamp: datetime = datetime.utcnow()

class BetCommand(BaseModel):
    """Parsed betting command from natural language"""
    bet_type: BetType
    numbers: List[int]
    amount: float
    confidence: float  # 0.0 to 1.0
    raw_command: str
