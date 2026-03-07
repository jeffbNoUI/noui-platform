package introspect

import "testing"

func TestNewAdapterMySQL(t *testing.T) {
	adapter := NewAdapter("mysql")
	if _, ok := adapter.(*MySQLAdapter); !ok {
		t.Errorf("Expected *MySQLAdapter, got %T", adapter)
	}
}

func TestNewAdapterPostgres(t *testing.T) {
	adapter := NewAdapter("postgres")
	if _, ok := adapter.(*PostgresAdapter); !ok {
		t.Errorf("Expected *PostgresAdapter, got %T", adapter)
	}
}

func TestNewAdapterMSSQL(t *testing.T) {
	adapter := NewAdapter("mssql")
	if _, ok := adapter.(*MSSQLAdapter); !ok {
		t.Errorf("Expected *MSSQLAdapter, got %T", adapter)
	}
}

func TestNewAdapterDefault(t *testing.T) {
	adapter := NewAdapter("unknown")
	if _, ok := adapter.(*MySQLAdapter); !ok {
		t.Errorf("Unknown driver should default to *MySQLAdapter, got %T", adapter)
	}
}
