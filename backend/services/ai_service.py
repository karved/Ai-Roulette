import re
import openai
from typing import Optional
from models.game import BetCommand, BetType, Player
import os

class AIService:
    """AI service with backup natural language parser"""
    
    def __init__(self):
        self.openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None
        self.backup_parser = BackupBetParser()

    async def process_message(self, message: str, player: Player) -> str:
        """Process chat message with AI assistance"""
        try:
            if self.openai_client:
                response = await self._openai_chat(message, player)
                return response
        except Exception as e:
            print(f"OpenAI API error: {e}")
        
        # Fallback to rule-based responses
        return self._fallback_chat_response(message)

    async def parse_bet_command(self, command: str) -> Optional[BetCommand]:
        """Parse natural language betting command with backup parser"""
        try:
            if self.openai_client:
                parsed = await self._openai_parse_bet(command)
                if parsed:
                    return parsed
        except Exception as e:
            print(f"OpenAI parsing error: {e}")
        
        # Use backup parser
        return self.backup_parser.parse(command)

    async def _openai_chat(self, message: str, player: Player) -> str:
        """Chat using OpenAI API"""
        system_prompt = f"""You are an AI assistant for a multiplayer roulette game. Help the player with game rules, betting strategies, and guidance.

GAME RULES:
- European roulette wheel (0-36, single zero)
- Players start with $100 balance
- Betting phase: 30 seconds to place bets
- Spinning phase: wheel spins, no betting allowed
- Results phase: payouts calculated, leaderboard updated

BET TYPES & PAYOUTS:
- Straight (single number): 35:1 payout
- Split (2 adjacent numbers): 17:1 payout
- Street (3 numbers in row): 11:1 payout
- Corner (4 numbers in square): 8:1 payout
- Line (6 numbers in two rows): 5:1 payout
- Red/Black: 1:1 payout (18 numbers each)
- Even/Odd: 1:1 payout (18 numbers each) 
- Low (1-18)/High (19-36): 1:1 payout
- Dozens (1-12, 13-24, 25-36): 2:1 payout
- Columns: 2:1 payout

COMPOUND BETTING FEATURES:
- Split: Select 2 adjacent numbers (horizontal/vertical)
- Street: Select 3 consecutive numbers in same row
- Corner: Select 4 numbers forming 2x2 square
- Line: Select 6 consecutive numbers spanning 2 rows
- Validation ensures proper number adjacency/patterns
- Visual selection on roulette table with gold highlighting

GAME STATE & FEATURES:
- Player: {player.username}
- Balance: ${player.balance}
- Multi-input support: voice commands, mouse clicks, keyboard
- Voice recognition with speech-to-text parsing
- Recent rolls tracking (last 10 spins)
- Compound betting mode with visual selection
- Bet removal/undo functionality
- Automatic game phase transitions
- WebSocket real-time updates

VOICE COMMANDS SUPPORTED:
- "bet [amount] on [red/black/even/odd/low/high]"
- "place [amount] on number [0-36]"
- "remove bet on [type]" or "undo [type]"
- Common speech recognition error corrections built-in

Keep responses concise, helpful, and focused on roulette strategy and rules."""
        
        response = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            max_tokens=150
        )
        
        return response.choices[0].message.content

    async def _openai_parse_bet(self, command: str) -> Optional[BetCommand]:
        """Parse betting command using OpenAI"""
        system_prompt = """Parse betting commands into structured format. Return JSON with:
        {
            "bet_type": "straight|red|black|even|odd|low|high|dozen|column",
            "numbers": [list of numbers if applicable],
            "amount": float,
            "confidence": 0.0-1.0
        }
        
        Examples:
        "bet 10 on red" -> {"bet_type": "red", "numbers": [], "amount": 10, "confidence": 0.9}
        "place 5 on number 7" -> {"bet_type": "straight", "numbers": [7], "amount": 5, "confidence": 0.9}
        """
        
        response = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": command}
            ],
            max_tokens=100
        )
        
        try:
            import json
            parsed = json.loads(response.choices[0].message.content)
            return BetCommand(
                bet_type=BetType(parsed["bet_type"]),
                numbers=parsed["numbers"],
                amount=parsed["amount"],
                confidence=parsed["confidence"],
                raw_command=command
            )
        except (json.JSONDecodeError, KeyError, ValueError):
            return None

    def _fallback_chat_response(self, message: str) -> str:
        """Simple rule-based chat responses"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ["rule", "how", "play"]):
            return "Place bets on numbers, colors, or groups. The wheel spins and if your bet wins, you get paid according to the odds!"
        
        elif any(word in message_lower for word in ["odd", "payout", "pay"]):
            return "Straight number bets pay 35:1, red/black pay 1:1, dozens pay 2:1. Higher risk = higher reward!"
        
        elif any(word in message_lower for word in ["strategy", "tip", "advice"]):
            return "Start with outside bets (red/black, odd/even) for better odds, or try straight numbers for big payouts!"
        
        else:
            return "I'm here to help with roulette! Ask me about rules, odds, or betting strategies."


class BackupBetParser:
    """Backup natural language parser for betting commands"""
    
    def __init__(self):
        # Betting patterns with regex
        self.patterns = {
            # "bet 10 on red", "place 5 on black"
            BetType.RED: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+red",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?red"
            ],
            BetType.BLACK: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+black",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?black"
            ],
            BetType.EVEN: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+even",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?even"
            ],
            BetType.ODD: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+odd",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?odd"
            ],
            BetType.LOW: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:low|1-18)",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?(?:low|1-18)"
            ],
            BetType.HIGH: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:high|19-36)",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?(?:high|19-36)"
            ],
            BetType.STRAIGHT: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:number\s+)?(\d+)",
                r"(\d+(?:\.\d+)?)\s+on\s+(\d+)",
                r"straight\s+(\d+(?:\.\d+)?)\s+on\s+(\d+)"
            ]
        }

    def parse(self, command: str) -> Optional[BetCommand]:
        """Parse betting command using regex patterns"""
        command_clean = command.lower().strip()
        
        for bet_type, patterns in self.patterns.items():
            for pattern in patterns:
                match = re.search(pattern, command_clean)
                if match:
                    try:
                        if bet_type == BetType.STRAIGHT:
                            amount = float(match.group(1))
                            number = int(match.group(2))
                            if 0 <= number <= 36:
                                return BetCommand(
                                    bet_type=bet_type,
                                    numbers=[number],
                                    amount=amount,
                                    confidence=0.8,
                                    raw_command=command
                                )
                        else:
                            amount = float(match.group(1))
                            return BetCommand(
                                bet_type=bet_type,
                                numbers=[],
                                amount=amount,
                                confidence=0.8,
                                raw_command=command
                            )
                    except (ValueError, IndexError):
                        continue
        
        return None
