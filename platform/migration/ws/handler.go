package ws

import (
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/noui/platform/auth"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		allowed := os.Getenv("CORS_ORIGIN")
		if allowed == "" {
			allowed = "http://localhost:3000"
		}
		return origin == allowed
	},
}

// ServeWS handles WebSocket upgrade requests for a specific engagement.
// Route: GET /ws/migration/{engagementId}
//
// Authentication: JWT is read from the Authorization header (Bearer <token>)
// or from the ?token= query parameter (needed because the browser WebSocket
// API cannot set custom headers).
func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("engagementId")
	if engagementID == "" {
		http.Error(w, "missing engagementId", http.StatusBadRequest)
		return
	}

	// Extract JWT from header or query param.
	token := ""
	if authHeader := r.Header.Get("Authorization"); strings.HasPrefix(authHeader, "Bearer ") {
		token = strings.TrimPrefix(authHeader, "Bearer ")
	} else if t := r.URL.Query().Get("token"); t != "" {
		token = t
	}

	if token == "" {
		http.Error(w, "missing authentication token", http.StatusUnauthorized)
		return
	}

	claims, err := auth.ValidateToken(token)
	if err != nil {
		slog.Warn("ws auth failed", "error", err, "engagement_id", engagementID)
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws upgrade failed", "error", err, "engagement_id", engagementID)
		return
	}

	client := NewClient(hub, conn, engagementID)
	client.tenantID = claims.TenantID
	hub.register <- client

	slog.Info("ws authenticated", "engagement_id", engagementID, "tenant_id", claims.TenantID, "user_id", claims.Sub)

	go client.WritePump()
	go client.ReadPump()
}
