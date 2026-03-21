package ws

import (
	"encoding/json"
	"log/slog"
	"sync"
)

// Event represents a WebSocket event broadcast to clients.
type Event struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// Hub manages WebSocket connections organized by engagement ID.
type Hub struct {
	mu         sync.RWMutex
	rooms      map[string]map[*Client]bool // engagementID -> set of clients
	register   chan *Client
	unregister chan *Client
}

// NewHub creates a new Hub.
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run processes register/unregister requests. Call as a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if h.rooms[client.engagementID] == nil {
				h.rooms[client.engagementID] = make(map[*Client]bool)
			}
			h.rooms[client.engagementID][client] = true
			count := len(h.rooms[client.engagementID])
			h.mu.Unlock()
			slog.Info("ws client registered", "engagement_id", client.engagementID, "clients", count)

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.rooms[client.engagementID]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.send)
					if len(clients) == 0 {
						delete(h.rooms, client.engagementID)
					}
				}
			}
			h.mu.Unlock()
			slog.Info("ws client unregistered", "engagement_id", client.engagementID)
		}
	}
}

// Broadcast sends an event to all clients in an engagement room.
func (h *Hub) Broadcast(engagementID string, event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		slog.Error("ws broadcast marshal failed", "error", err)
		return
	}

	h.mu.RLock()
	clients := h.rooms[engagementID]
	h.mu.RUnlock()

	for client := range clients {
		select {
		case client.send <- data:
		default:
			// Client buffer full — drop and clean up
			go func(c *Client) {
				h.unregister <- c
			}(client)
		}
	}
}

// ClientCount returns the number of connected clients for an engagement.
func (h *Hub) ClientCount(engagementID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.rooms[engagementID])
}
