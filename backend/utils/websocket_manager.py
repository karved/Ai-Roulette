from fastapi import WebSocket
from typing import Dict, List, Any
import json
from models.game import Bet, SpinResult

class WebSocketManager:
    """Manage WebSocket connections for real-time game updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        """Remove WebSocket connection"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_personal_message(self, message: str, client_id: str):
        """Send message to specific client"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_text(message)
            except:
                # Connection closed, remove it
                self.disconnect(client_id)

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        message_str = json.dumps(message)
        disconnected_clients = []
        
        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(message_str)
            except:
                # Connection closed, mark for removal
                disconnected_clients.append(client_id)
        
        # Remove disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

    async def broadcast_bet(self, bet: Bet):
        """Broadcast new bet to all clients"""
        await self.broadcast({
            "type": "new_bet",
            "data": {
                "bet_id": bet.id,
                "player_id": bet.player_id,
                "bet_type": bet.bet_type.value,
                "amount": bet.amount,
                "numbers": bet.numbers
            }
        })

    async def broadcast_spin_result(self, spin_result: SpinResult):
        """Broadcast spin result to all clients"""
        await self.broadcast({
            "type": "spin_result",
            "data": {
                "winning_number": spin_result.winning_number,
                "color": spin_result.color,
                "is_even": spin_result.is_even,
                "is_low": spin_result.is_low,
                "dozen": spin_result.dozen,
                "column": spin_result.column
            }
        })

    async def broadcast_game_phase(self, phase: str, time_remaining: int):
        """Broadcast game phase change"""
        await self.broadcast({
            "type": "phase_change",
            "data": {
                "phase": phase,
                "time_remaining": time_remaining
            }
        })
