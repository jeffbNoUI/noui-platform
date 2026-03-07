package monitor

import "testing"

func TestNewMonitorAdapterMySQL(t *testing.T) {
	adapter := NewMonitorAdapter("mysql")
	if _, ok := adapter.(*MySQLMonitorAdapter); !ok {
		t.Errorf("expected *MySQLMonitorAdapter, got %T", adapter)
	}
}

func TestNewMonitorAdapterPostgres(t *testing.T) {
	adapter := NewMonitorAdapter("postgres")
	if _, ok := adapter.(*PostgresMonitorAdapter); !ok {
		t.Errorf("expected *PostgresMonitorAdapter, got %T", adapter)
	}
}

func TestNewMonitorAdapterMSSQL(t *testing.T) {
	adapter := NewMonitorAdapter("mssql")
	if _, ok := adapter.(*MSSQLMonitorAdapter); !ok {
		t.Errorf("expected *MSSQLMonitorAdapter, got %T", adapter)
	}
}

func TestNewMonitorAdapterDefault(t *testing.T) {
	adapter := NewMonitorAdapter("unknown")
	if _, ok := adapter.(*MySQLMonitorAdapter); !ok {
		t.Errorf("expected default *MySQLMonitorAdapter for unknown driver, got %T", adapter)
	}
}
