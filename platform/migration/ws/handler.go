package ws

import (
	"log/slog"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// In production, check against CORS_ORIGIN env var
		return true
	},
}

// ServeWS handles WebSocket upgrade requests for a specific engagement.
// Route: GET /ws/migration/{engagementId}
func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("engagementId")
	if engagementID == "" {
		http.Error(w, "missing engagementId", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws upgrade failed", "error", err, "engagement_id", engagementID)
		return
	}

	client := NewClient(hub, conn, engagementID)
	hub.register <- client

	go client.WritePump()
	go client.ReadPump()
}
