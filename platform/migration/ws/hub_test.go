package ws

import (
	"encoding/json"
	"testing"
	"time"
)

func TestHubBroadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	// Create a mock client with a send channel
	send := make(chan []byte, 10)
	client := &Client{
		hub:          hub,
		engagementID: "test-eng-1",
		send:         send,
	}

	hub.register <- client
	time.Sleep(10 * time.Millisecond) // let Run() process

	if hub.ClientCount("test-eng-1") != 1 {
		t.Fatalf("expected 1 client, got %d", hub.ClientCount("test-eng-1"))
	}

	// Broadcast an event
	event := Event{
		Type:    "batch_completed",
		Payload: json.RawMessage(`{"batch_id":"b1"}`),
	}
	hub.Broadcast("test-eng-1", event)

	select {
	case msg := <-send:
		var got Event
		if err := json.Unmarshal(msg, &got); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if got.Type != "batch_completed" {
			t.Errorf("expected type batch_completed, got %s", got.Type)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for broadcast")
	}

	// Broadcast to different engagement — should not receive
	hub.Broadcast("other-eng", Event{Type: "test", Payload: json.RawMessage(`{}`)})
	select {
	case <-send:
		t.Fatal("received message for wrong engagement")
	case <-time.After(50 * time.Millisecond):
		// expected
	}
}

func TestHubUnregister(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	send := make(chan []byte, 10)
	client := &Client{
		hub:          hub,
		engagementID: "test-eng-2",
		send:         send,
	}

	hub.register <- client
	time.Sleep(10 * time.Millisecond)

	hub.unregister <- client
	time.Sleep(10 * time.Millisecond)

	if hub.ClientCount("test-eng-2") != 0 {
		t.Fatalf("expected 0 clients after unregister, got %d", hub.ClientCount("test-eng-2"))
	}
}
