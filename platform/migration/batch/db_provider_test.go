package batch

import "testing"

// TestDBSourceRowProvider_ImplementsInterface verifies that
// DBSourceRowProvider satisfies the SourceRowProvider interface at compile time.
func TestDBSourceRowProvider_ImplementsInterface(t *testing.T) {
	var _ SourceRowProvider = &DBSourceRowProvider{}
}

func TestDriverFromDSN(t *testing.T) {
	tests := []struct {
		name string
		dsn  string
		want string
	}{
		{
			name: "postgres URL style",
			dsn:  "postgres://user:pass@host:5432/db",
			want: "postgres",
		},
		{
			name: "postgres key-value style",
			dsn:  "host=localhost port=5432 user=test dbname=mydb",
			want: "postgres",
		},
		{
			name: "sqlserver URL style",
			dsn:  "sqlserver://user:pass@host:1433?database=db",
			want: "sqlserver",
		},
		{
			name: "empty string defaults to postgres",
			dsn:  "",
			want: "postgres",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := driverFromDSN(tt.dsn)
			if got != tt.want {
				t.Errorf("driverFromDSN(%q) = %q, want %q", tt.dsn, got, tt.want)
			}
		})
	}
}

func TestDBSourceRowProvider_Fields(t *testing.T) {
	p := &DBSourceRowProvider{
		DSN:       "postgres://user:pass@localhost:5432/testdb",
		TableName: "src_prism.prism_member",
		KeyColumn: "member_id",
	}

	if p.DSN != "postgres://user:pass@localhost:5432/testdb" {
		t.Error("DSN not set correctly")
	}
	if p.TableName != "src_prism.prism_member" {
		t.Error("TableName not set correctly")
	}
	if p.KeyColumn != "member_id" {
		t.Error("KeyColumn not set correctly")
	}
}
