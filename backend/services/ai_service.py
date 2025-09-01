import re
import openai
from typing import Optional, List
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

📊 **BET TYPES & PAYOUTS:**

**Inside Bets (Higher Risk, Higher Reward):**
• **Straight** (single number): 35:1 payout
• **Split** (2 adjacent numbers): 17:1 payout  
• **Street** (3 numbers in row): 11:1 payout
• **Corner** (4 numbers in square): 8:1 payout
• **Line** (6 numbers in two rows): 5:1 payout

**Outside Bets (Lower Risk, Steady Returns):**
• **Red/Black**: 1:1 payout (18 numbers each)
• **Even/Odd**: 1:1 payout (18 numbers each)
• **Low (1-18)/High (19-36)**: 1:1 payout
• **Dozens** (1st: 1-12, 2nd: 13-24, 3rd: 25-36): 2:1 payout
• **Columns** (vertical lines): 2:1 payout

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
            "bet_type": "straight|split|street|corner|line|red|black|even|odd|low|high|dozen_first|dozen_second|dozen_third|column_first|column_second|column_third",
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
            return """💰 **PAYOUTS:**

Straight number (35:1), Red/Black/Even/Odd/Low/High (1:1), Dozens/Columns (2:1). The house edge is 2.7% on European roulette.

**Inside Bets:**
• Straight (1 number): 35:1
• Split (2 numbers): 17:1  
• Street (3 numbers): 11:1
• Corner (4 numbers): 8:1
• Line (6 numbers): 5:1

**Outside Bets:**
• Red/Black, Even/Odd, Low/High: 1:1
• Dozens & Columns: 2:1

Higher risk = higher reward! 🎯"""
        
        elif any(word in message_lower for word in ["strategy", "tip", "advice"]):
            return """🎲 **BETTING STRATEGIES:**

**For Beginners:**
• Start with outside bets (red/black, odd/even)
• Better odds but smaller payouts

**For Risk-Takers:**
• Try straight numbers for 35:1 payouts
• Use compound bets (splits, corners)

**Pro Tips:**
• Manage your bankroll wisely
• Set win/loss limits
• Mix inside and outside bets

Good luck! 🍀"""
        
        else:
            return "I'm here to help with roulette! Ask me about rules, odds, or betting strategies."


class BackupBetParser:
    """Backup natural language parser for betting commands"""
    
    def __init__(self):
        # Betting patterns with regex
        self.patterns = {
            # Basic outside bets
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
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:low|1-18|1\s*-\s*18)",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?(?:low|1-18|1\s*-\s*18)"
            ],
            BetType.HIGH: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:high|19-36|19\s*-\s*36)",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?(?:high|19-36|19\s*-\s*36)"
            ],
            
            # Dozen bets
            BetType.DOZEN: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:first|1st)\s+dozen",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+dozen\s+(?:1|one|first)",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:second|2nd)\s+dozen",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+dozen\s+(?:2|two|second)",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:third|3rd)\s+dozen",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+dozen\s+(?:3|three|third)",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?(?:first|1st|second|2nd|third|3rd)\s+dozen"
            ],
            
            # Column bets
            BetType.COLUMN: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:first|1st)\s+column",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+column\s+(?:1|one|first)",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:second|2nd)\s+column",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+column\s+(?:2|two|second)",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:third|3rd)\s+column",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+column\s+(?:3|three|third)",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?(?:first|1st|second|2nd|third|3rd)\s+column"
            ],
            
            # Inside bets - Straight numbers
            BetType.STRAIGHT: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:number\s+)?(\d+)",
                r"(\d+(?:\.\d+)?)\s+on\s+(\d+)",
                r"straight\s+(\d+(?:\.\d+)?)\s+on\s+(\d+)"
            ],
            
            # Split bets (2 adjacent numbers)
            BetType.SPLIT: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+split\s+(\d+)\s*[,/&-]\s*(\d+)",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(\d+)\s*[,/&-]\s*(\d+)\s+split",
                r"split\s+(\d+(?:\.\d+)?)\s+on\s+(\d+)\s*[,/&-]\s*(\d+)",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?split\s+(\d+)\s*[,/&-]\s*(\d+)"
            ],
            
            # Street bets (3 numbers in a row)
            BetType.STREET: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+street\s+(\d+)\s*[,/-]\s*(\d+)\s*[,/-]\s*(\d+)",
                r"street\s+(\d+(?:\.\d+)?)\s+on\s+(\d+)\s*[,/-]\s*(\d+)\s*[,/-]\s*(\d+)",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?street\s+(\d+)\s*[,/-]\s*(\d+)\s*[,/-]\s*(\d+)",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+row\s+(\d+)"
            ],
            
            # Corner bets (4 numbers in a square)
            BetType.CORNER: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+corner\s+(\d+)\s*[,/-]\s*(\d+)\s*[,/-]\s*(\d+)\s*[,/-]\s*(\d+)",
                r"corner\s+(\d+(?:\.\d+)?)\s+on\s+(\d+)\s*[,/-]\s*(\d+)\s*[,/-]\s*(\d+)\s*[,/-]\s*(\d+)",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?corner\s+(\d+)\s*[,/-]\s*(\d+)\s*[,/-]\s*(\d+)\s*[,/-]\s*(\d+)",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+square\s+(\d+)"
            ],
            
            # Line bets (6 numbers in two rows)
            BetType.LINE: [
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+line\s+(\d+)\s*-\s*(\d+)",
                r"line\s+(\d+(?:\.\d+)?)\s+on\s+(\d+)\s*-\s*(\d+)",
                r"(\d+(?:\.\d+)?)\s+(?:on\s+)?line\s+(\d+)\s*-\s*(\d+)",
                r"(?:bet|place|put)\s+(\d+(?:\.\d+)?)\s+on\s+(?:double\s+)?(?:street|row)\s+(\d+)"
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
                        amount = float(match.group(1))
                        
                        # Handle different bet types with proper number extraction
                        if bet_type == BetType.STRAIGHT:
                            number = int(match.group(2))
                            if 0 <= number <= 36:
                                return BetCommand(
                                    bet_type=bet_type,
                                    numbers=[number],
                                    amount=amount,
                                    confidence=0.8,
                                    raw_command=command
                                )
                        
                        elif bet_type == BetType.SPLIT:
                            if len(match.groups()) >= 3:
                                num1, num2 = int(match.group(2)), int(match.group(3))
                                if self._validate_split(num1, num2):
                                    return BetCommand(
                                        bet_type=bet_type,
                                        numbers=sorted([num1, num2]),
                                        amount=amount,
                                        confidence=0.8,
                                        raw_command=command
                                    )
                        
                        elif bet_type == BetType.STREET:
                            if len(match.groups()) >= 4:
                                numbers = [int(match.group(i)) for i in range(2, 5)]
                                if self._validate_street(numbers):
                                    return BetCommand(
                                        bet_type=bet_type,
                                        numbers=sorted(numbers),
                                        amount=amount,
                                        confidence=0.8,
                                        raw_command=command
                                    )
                            elif "row" in pattern:
                                # Handle "bet 10 on row 1" format
                                row = int(match.group(2))
                                if 1 <= row <= 12:
                                    numbers = [row*3-2, row*3-1, row*3]
                                    return BetCommand(
                                        bet_type=bet_type,
                                        numbers=numbers,
                                        amount=amount,
                                        confidence=0.8,
                                        raw_command=command
                                    )
                        
                        elif bet_type == BetType.CORNER:
                            if len(match.groups()) >= 5:
                                numbers = [int(match.group(i)) for i in range(2, 6)]
                                if self._validate_corner(numbers):
                                    return BetCommand(
                                        bet_type=bet_type,
                                        numbers=sorted(numbers),
                                        amount=amount,
                                        confidence=0.8,
                                        raw_command=command
                                    )
                            elif "square" in pattern:
                                # Handle "bet 10 on square 1" format (top-left corner)
                                corner = int(match.group(2))
                                numbers = self._get_corner_numbers(corner)
                                if numbers:
                                    return BetCommand(
                                        bet_type=bet_type,
                                        numbers=numbers,
                                        amount=amount,
                                        confidence=0.8,
                                        raw_command=command
                                    )
                        
                        elif bet_type == BetType.LINE:
                            if len(match.groups()) >= 3:
                                start_num = int(match.group(2))
                                end_num = int(match.group(3))
                                numbers = self._get_line_numbers(start_num, end_num)
                                if numbers:
                                    return BetCommand(
                                        bet_type=bet_type,
                                        numbers=numbers,
                                        amount=amount,
                                        confidence=0.8,
                                        raw_command=command
                                    )
                            elif "double" in pattern or "street" in pattern:
                                # Handle "bet 10 on double street 1" format
                                row = int(match.group(2))
                                numbers = self._get_double_street_numbers(row)
                                if numbers:
                                    return BetCommand(
                                        bet_type=bet_type,
                                        numbers=numbers,
                                        amount=amount,
                                        confidence=0.8,
                                        raw_command=command
                                    )
                        
                        elif bet_type == BetType.DOZEN:
                            # Extract dozen number from pattern match
                            dozen_num = self._extract_dozen_number(command_clean)
                            if dozen_num:
                                return BetCommand(
                                    bet_type=bet_type,
                                    numbers=[dozen_num],  # 1, 2, or 3
                                    amount=amount,
                                    confidence=0.8,
                                    raw_command=command
                                )
                        
                        elif bet_type == BetType.COLUMN:
                            # Extract column number from pattern match
                            column_num = self._extract_column_number(command_clean)
                            if column_num:
                                return BetCommand(
                                    bet_type=bet_type,
                                    numbers=[column_num],  # 1, 2, or 3
                                    amount=amount,
                                    confidence=0.8,
                                    raw_command=command
                                )
                        
                        else:
                            # Outside bets (red, black, even, odd, low, high)
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
    
    def _validate_split(self, num1: int, num2: int) -> bool:
        """Validate that two numbers are adjacent for split bet"""
        if not (0 <= num1 <= 36 and 0 <= num2 <= 36):
            return False
        
        # Check horizontal adjacency (same row)
        if abs(num1 - num2) == 1:
            # Make sure they're in the same row (not crossing row boundaries)
            if num1 == 0 or num2 == 0:  # Zero can split with 1, 2, 3
                return num1 in [0, 1, 2, 3] and num2 in [0, 1, 2, 3]
            row1 = (num1 - 1) // 3
            row2 = (num2 - 1) // 3
            return row1 == row2
        
        # Check vertical adjacency (same column, 3 numbers apart)
        if abs(num1 - num2) == 3:
            return True
            
        return False
    
    def _validate_street(self, numbers: List[int]) -> bool:
        """Validate that three numbers form a valid street"""
        if len(numbers) != 3:
            return False
        
        numbers.sort()
        # Check if they're consecutive and in the same row
        if numbers[1] - numbers[0] == 1 and numbers[2] - numbers[1] == 1:
            # Check if they're all in the same row
            row = (numbers[0] - 1) // 3
            return all((num - 1) // 3 == row for num in numbers if num > 0)
        
        return False
    
    def _validate_corner(self, numbers: List[int]) -> bool:
        """Validate that four numbers form a valid corner"""
        if len(numbers) != 4:
            return False
        
        numbers.sort()
        # Check if they form a 2x2 square
        return (numbers[1] - numbers[0] == 1 and 
                numbers[2] - numbers[0] == 3 and 
                numbers[3] - numbers[1] == 3)
    
    def _get_corner_numbers(self, corner_id: int) -> Optional[List[int]]:
        """Get corner numbers by corner ID (simplified)"""
        # This is a simplified version - you might want to expand this
        corner_map = {
            1: [1, 2, 4, 5], 2: [2, 3, 5, 6], 3: [4, 5, 7, 8],
            4: [5, 6, 8, 9], 5: [7, 8, 10, 11], 6: [8, 9, 11, 12]
        }
        return corner_map.get(corner_id)
    
    def _get_line_numbers(self, start: int, end: int) -> Optional[List[int]]:
        """Get line numbers from start to end"""
        if abs(end - start) == 5 and start % 3 == 1:  # Should be 6 consecutive numbers
            return list(range(start, end + 1))
        return None
    
    def _get_double_street_numbers(self, row: int) -> Optional[List[int]]:
        """Get double street numbers by row"""
        if 1 <= row <= 11:
            start = row * 3 - 2
            return list(range(start, start + 6))
        return None
    
    def _extract_dozen_number(self, command: str) -> Optional[int]:
        """Extract dozen number from command"""
        if any(word in command for word in ["first", "1st", "one", "dozen 1"]):
            return 1
        elif any(word in command for word in ["second", "2nd", "two", "dozen 2"]):
            return 2
        elif any(word in command for word in ["third", "3rd", "three", "dozen 3"]):
            return 3
        return None
    
    def _extract_column_number(self, command: str) -> Optional[int]:
        """Extract column number from command"""
        if any(word in command for word in ["first", "1st", "one", "column 1"]):
            return 1
        elif any(word in command for word in ["second", "2nd", "two", "column 2"]):
            return 2
        elif any(word in command for word in ["third", "3rd", "three", "column 3"]):
            return 3
        return None
