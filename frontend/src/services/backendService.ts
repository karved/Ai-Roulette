// Backend service for secure server-side game operations
import { authService } from './authService';

export interface BetRequest {
  bet_type: string;
  numbers: number[];
  amount: number;
}

export interface BetResponse {
  success: boolean;
  bet_id: string;
  message: string;
  new_balance: number;
  potential_payout: number;
}

export interface SpinRequest {
  balance: number;
  bets: Array<{
    betType: string;
    numbers: number[];
    amount: number;
  }>;
}

export interface SpinResponse {
  winning_number: number;
  color: string;
  is_even: boolean;
  is_low: boolean;
  dozen: number;
  column: number;
  payouts: Array<{
    amount: number;
    bet_type: string;
    bet_amount: number;
    winnings: number;
  }>;
  total_wagered: number;
  total_won: number;
  net_result: number;
  new_balance: number;
  win_rate: number;
  winning_bets: number;
  total_bets: number;
}

export interface GameState {
  phase: string;
  time_remaining: number;
  player_balance: number;
  active_bets: number;
  recent_spins: Array<{
    winning_number: number;
    color: string;
    timestamp: string;
  }>;
  player_count: number;
}

export interface HotColdAnalysis {
  hot: Array<{ number: number; count: number }>;
  cold: Array<{ number: number; count: number }>;
}

class BackendService {
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private wsCallbacks: Map<string, Function> = new Map();

  constructor() {
    this.baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    this.wsUrl = this.baseUrl.replace('http', 'ws');
  }

  // HTTP API Methods
  async getGameState(): Promise<GameState> {
    const response = await fetch(`${this.baseUrl}/game-state`, {
      headers: authService.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to get game state: ${response.statusText}`);
    }
    return response.json();
  }

  async placeBet(betRequest: BetRequest): Promise<BetResponse> {
    const response = await fetch(`${this.baseUrl}/game/place-bet`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify(betRequest),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to place bet');
    }

    return response.json();
  }

  async getWinningNumber(): Promise<{
    winning_number: number;
    color: string;
    is_even: boolean;
    is_low: boolean;
    dozen: number;
    column: number;
  }> {
    const response = await fetch(`${this.baseUrl}/game/get-winning-number`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get winning number');
    }

    return response.json();
  }

  async spinWheel(spinData: SpinRequest): Promise<SpinResponse> {
    const response = await fetch(`${this.baseUrl}/game/spin`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify(spinData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to spin wheel');
    }

    return response.json();
  }

  async resetPhase(): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/game/reset-phase`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to reset game phase');
    }

    return response.json();
  }

  // async getHotColdNumbers(): Promise<HotColdAnalysis> {
  //   const response = await fetch(`${this.baseUrl}/analytics/hot-cold`, {
  //     headers: authService.getAuthHeaders(),
  //   });
  //   if (!response.ok) {
  //     throw new Error('Failed to get hot/cold analysis');
  //   }
  //   return response.json();
  // }

  async chatWithAI(message: string): Promise<{ response: string }> {
    const response = await fetch(`${this.baseUrl}/ai/chat`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      throw new Error('Failed to chat with AI');
    }

    return response.json();
  }

  async parseBetCommand(command: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/ai/parse-bet`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify({ text: command }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse bet command');
    }

    return response.json();
  }

  async getPlayerStats(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/player/stats`, {
      headers: authService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get player stats');
    }

    return response.json();
  }

  async analyzeBettingPattern(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/ai/analyze-pattern`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze betting pattern');
    }

    return response.json();
  }

  // WebSocket Methods
  connectWebSocket(clientId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.wsUrl}/ws/${clientId}`);
        
        this.ws.onopen = () => {
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const callback = this.wsCallbacks.get(data.type);
            if (callback) {
              callback(data);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          // Auto-reconnect after 3 seconds
          setTimeout(() => {
            if (this.ws?.readyState === WebSocket.CLOSED) {
              this.connectWebSocket(clientId);
            }
          }, 3000);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsCallbacks.clear();
  }

  onWebSocketMessage(type: string, callback: Function): void {
    this.wsCallbacks.set(type, callback);
  }

  sendWebSocketMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  requestGameState(): void {
    this.sendWebSocketMessage({ type: 'get_game_state' });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    
    if (!response.ok) {
      throw new Error('Backend health check failed');
    }
    
    return response.json();
  }
}

export const backendService = new BackendService();
export default backendService;
