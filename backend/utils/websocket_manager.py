from fastapi import WebSocket
from typing import List, Dict
import json
from datetime import datetime

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.client_connections: Dict[str, WebSocket] = {}
        self.player_sessions: Dict[str, Dict] = {}
        self.game_rooms: Dict[str, List[str]] = {"default": []}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.client_connections[client_id] = websocket
        
        self.player_sessions[client_id] = {
            "connected_at": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "room": "default",
            "player_id": None
        }
        
        if client_id not in self.game_rooms["default"]:
            self.game_rooms["default"].append(client_id)
        
        await self.send_personal_message(json.dumps({
            "type": "connection_established",
            "client_id": client_id,
            "timestamp": datetime.utcnow().isoformat()
        }), client_id)

    def disconnect(self, client_id: str):
        if client_id in self.client_connections:
            websocket = self.client_connections[client_id]
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
            del self.client_connections[client_id]
        
        if client_id in self.player_sessions:
            del self.player_sessions[client_id]
        
        for room_players in self.game_rooms.values():
            if client_id in room_players:
                room_players.remove(client_id)

    async def send_personal_message(self, message: str, client_id: str):
        if client_id in self.client_connections:
            websocket = self.client_connections[client_id]
            try:
                await websocket.send_text(message)
                if client_id in self.player_sessions:
                    self.player_sessions[client_id]["last_activity"] = datetime.utcnow()
            except Exception:
                self.disconnect(client_id)

    async def broadcast(self, message: str, room: str = "default"):
        if room not in self.game_rooms:
            return
        
        dead_connections = []
        for client_id in self.game_rooms[room]:
            if client_id in self.client_connections:
                try:
                    await self.client_connections[client_id].send_text(message)
                except Exception:
                    dead_connections.append(client_id)
        
        for client_id in dead_connections:
            self.disconnect(client_id)

    async def broadcast_game_state(self, game_state: Dict, room: str = "default"):
        message = {
            "type": "game_state_update",
            "data": game_state,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(json.dumps(message), room)

    async def broadcast_spin_result(self, spin_result: Dict, payouts: List[Dict] = None, room: str = "default"):
        message = {
            "type": "spin_result",
            "data": {
                "spin": spin_result,
                "payouts": payouts or [],
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        await self.broadcast(json.dumps(message), room)

    async def send_error(self, client_id: str, error_message: str, error_code: str = "GAME_ERROR"):
        message = {
            "type": "error",
            "data": {
                "message": error_message,
                "code": error_code
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.send_personal_message(json.dumps(message), client_id)

    def get_room_player_count(self, room: str = "default") -> int:
        return len(self.game_rooms.get(room, []))
