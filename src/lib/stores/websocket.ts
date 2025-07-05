// src\lib\stores\websocket.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface WebSocketMessage {
  type: string;
  message?: string;
  timestamp: string;
  [key: string]: any;
}

// WebSocket connection state
export const wsConnected = writable(false);
export const wsMessages = writable<WebSocketMessage[]>([]);
export const wsConnectionCount = writable(0);

class WebSocketStore {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;

  connect() {
    if (!browser) return;

    const wsUrl = import.meta.env.PROD 
      ? 'wss://your-domain.com' 
      : 'ws://localhost:3000';

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        wsConnected.set(true);
        this.reconnectAttempts = 0;
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 Received:', data);
          
          // Add message to store
          wsMessages.update(messages => [...messages, data]);
          
          // Handle specific message types
          if (data.type === 'welcome') {
            console.log('Welcome message received');
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        wsConnected.set(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        wsConnected.set(false);
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('🚫 Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimeout) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;

    console.log(`⏰ Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('❌ WebSocket not connected');
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    wsConnected.set(false);
  }
}

export const websocketStore = new WebSocketStore();

// Auto-connect when store is imported
if (browser) {
  websocketStore.connect();
}