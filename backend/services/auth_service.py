from supabase import create_client, Client
from typing import Optional, Dict, Any
from models.game import Player
from datetime import datetime
import os

class AuthService:
    """Authentication service using Supabase Auth"""
    
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        if supabase_url and supabase_key:
            self.supabase: Client = create_client(supabase_url, supabase_key)
        else:
            self.supabase = None
            print("Warning: Supabase credentials not found, using mock auth")

    async def login(self, email: str, password: str) -> Dict[str, Any]:
        """User login"""
        try:
            if not self.supabase:
                return self._mock_login_response()
            
            response = self.supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if response.user:
                # Update last active timestamp
                await self._update_last_active(response.user.id)
                
                return {
                    "access_token": response.session.access_token,
                    "user": {
                        "id": response.user.id,
                        "email": response.user.email,
                        "username": response.user.user_metadata.get("username", email.split("@")[0])
                    }
                }
            else:
                raise Exception("Invalid credentials")
                
        except Exception as e:
            print(f"Login error: {e}")
            return {"error": str(e)}

    async def register(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """User registration"""
        try:
            if not self.supabase:
                return self._mock_register_response()
            
            response = self.supabase.auth.sign_up({
                "email": user_data["email"],
                "password": user_data["password"],
                "options": {
                    "data": {
                        "username": user_data.get("username", user_data["email"].split("@")[0])
                    }
                }
            })
            
            if response.user:
                # Create player record
                await self._create_player_record(response.user)
                
                return {
                    "message": "Registration successful",
                    "user": {
                        "id": response.user.id,
                        "email": response.user.email,
                        "username": response.user.user_metadata.get("username")
                    }
                }
            else:
                raise Exception("Registration failed")
                
        except Exception as e:
            print(f"Registration error: {e}")
            return {"error": str(e)}

    async def verify_token(self, token: str) -> Optional[Player]:
        """Verify JWT token and return user"""
        try:
            if not self.supabase:
                return self._mock_player()
            
            response = self.supabase.auth.get_user(token)
            
            if response.user:
                # Get player data from database
                player_response = self.supabase.table("players").select("*").eq("id", response.user.id).single().execute()
                
                if player_response.data:
                    return Player(**player_response.data)
                    
        except Exception as e:
            print(f"Token verification error: {e}")
            
        return None

    async def _create_player_record(self, user) -> None:
        """Create player record in database"""
        if not self.supabase:
            return
        
        try:
            self.supabase.table("players").insert({
                "id": user.id,
                "email": user.email,
                "username": user.user_metadata.get("username", user.email.split("@")[0]),
                "balance": 100.0,
                "total_winnings": 0.0,
                "games_played": 0,
                "created_at": datetime.utcnow().isoformat(),
                "last_active": datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            print(f"Error creating player record: {e}")

    async def _update_last_active(self, user_id: str) -> None:
        """Update user's last active timestamp"""
        if not self.supabase:
            return
        
        try:
            self.supabase.table("players").update({
                "last_active": datetime.utcnow().isoformat()
            }).eq("id", user_id).execute()
        except Exception as e:
            print(f"Error updating last active: {e}")

    def _mock_login_response(self) -> Dict[str, Any]:
        """Mock login response for development"""
        return {
            "access_token": "mock-token-123",
            "user": {
                "id": "mock-user-1",
                "email": "test@example.com",
                "username": "testuser"
            }
        }

    def _mock_register_response(self) -> Dict[str, Any]:
        """Mock register response for development"""
        return {
            "message": "Registration successful",
            "user": {
                "id": "mock-user-1",
                "email": "test@example.com",
                "username": "testuser"
            }
        }

    def _mock_player(self) -> Player:
        """Mock player for development"""
        return Player(
            id="mock-user-1",
            email="test@example.com",
            username="testuser",
            balance=100.0,
            total_winnings=0.0,
            games_played=0,
            created_at=datetime.utcnow(),
            last_active=datetime.utcnow()
        )
