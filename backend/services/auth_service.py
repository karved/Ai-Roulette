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
                    },
                    "email_confirm": False
                }
            })
            
            if response.user:
                # Create player record immediately
                player_created = await self._create_player_record(response.user)
                
                if player_created:
                    return {
                        "message": "Registration successful - you can now login",
                        "user": {
                            "id": response.user.id,
                            "email": response.user.email,
                            "username": response.user.user_metadata.get("username")
                        }
                    }
                else:
                    return {"error": "Failed to create player record"}
            else:
                raise Exception("Registration failed")
                
        except Exception as e:
            return {"error": str(e)}

    async def verify_token(self, token: str) -> Optional[Player]:
        """Verify JWT token and return user"""
        try:
            if not self.supabase:
                return self._mock_player()
            
            response = self.supabase.auth.get_user(token)
            
            if response.user:
                # Get player data from database using service client to bypass RLS
                try:
                    from services.database import get_service_supabase
                    service_client = get_service_supabase()
                    player_response = service_client.table("players").select("*").eq("id", response.user.id).execute()
                    
                    if player_response.data and len(player_response.data) > 0:
                        # Update last active timestamp
                        await self._update_last_active(response.user.id)
                        return Player(**player_response.data[0])
                    else:
                        # Player record doesn't exist, try to create it
                        player_created = await self._create_player_record(response.user)
                        if player_created:
                            # Try to get the player record again
                            player_response = service_client.table("players").select("*").eq("id", response.user.id).execute()
                            if player_response.data and len(player_response.data) > 0:
                                return Player(**player_response.data[0])
                        else:
                            # If creation failed, try to get by email (might exist with different ID)
                            email_response = service_client.table("players").select("*").eq("email", response.user.email).execute()
                            if email_response.data and len(email_response.data) > 0:
                                # Update the player ID to match the auth user ID
                                existing_player = email_response.data[0]
                                if existing_player["id"] != response.user.id:
                                    # Update the player record with the correct auth ID
                                    service_client.table("players").update({
                                        "id": response.user.id,
                                        "last_active": datetime.utcnow().isoformat()
                                    }).eq("email", response.user.email).execute()
                                    existing_player["id"] = response.user.id
                                return Player(**existing_player)
                except Exception:
                    pass
                    
        except Exception:
            pass
            
        return None

    async def _create_player_record(self, user) -> bool:
        """Create player record in database"""
        if not self.supabase:
            return False
        
        try:
            # Get username from user_metadata or email
            username = user.email.split("@")[0] if user.email else f"user_{user.id[:8]}"
            if hasattr(user, 'user_metadata') and user.user_metadata:
                username = user.user_metadata.get("username", username)
            
            player_data = {
                "id": user.id,
                "email": user.email,
                "username": username,
                "balance": 100.0,
                "total_winnings": 0.0,
                "games_played": 0,
                "created_at": datetime.utcnow().isoformat(),
                "last_active": datetime.utcnow().isoformat()
            }
            
            # Use service role client for player creation to bypass RLS
            from services.database import get_service_supabase
            service_client = get_service_supabase()
            
            # First check if player already exists by ID or email  
            existing_by_id = service_client.table("players").select("*").eq("id", user.id).execute()
            existing_by_email = service_client.table("players").select("*").eq("email", user.email).execute()
            
            existing_check = None
            if existing_by_id.data:
                existing_check = existing_by_id
            elif existing_by_email.data:
                existing_check = existing_by_email
            
            if existing_check and existing_check.data and len(existing_check.data) > 0:
                # Update existing record with correct ID if needed
                existing_player = existing_check.data[0]
                if existing_player["id"] != user.id:
                    service_client.table("players").update({
                        "id": user.id,
                        "last_active": datetime.utcnow().isoformat()
                    }).eq("email", user.email).execute()
                return True
            
            # Try to create new player record
            service_client.table("players").insert(player_data).execute()
            return True
            
        except Exception as e:
            # Handle duplicate key constraint specifically
            if "duplicate key value violates unique constraint" in str(e):
                return True  # Consider this a success since the record exists
            
            return False

    async def _update_last_active(self, user_id: str) -> None:
        """Update user's last active timestamp"""
        if not self.supabase:
            return
        
        try:
            # Use service client to bypass RLS
            from services.database import get_service_supabase
            service_client = get_service_supabase()
            service_client.table("players").update({
                "last_active": datetime.utcnow().isoformat()
            }).eq("id", user_id).execute()
        except Exception:
            pass

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
