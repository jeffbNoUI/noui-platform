package suggestion

import "testing"

func TestComputeConvergence(t *testing.T) {
	dist := map[int]int{2: 7, 4: 2, 5: 1}
	pct, dominant := computeConvergence(dist, 10)
	if pct < 0.699 || pct > 0.701 {
		t.Errorf("expected ~0.70, got %f", pct)
	}
	if dominant != 2 {
		t.Errorf("expected dominant=2, got %d", dominant)
	}
}

func TestComputeConvergence_BelowThreshold(t *testing.T) {
	dist := map[int]int{2: 3, 4: 3, 5: 4}
	pct, _ := computeConvergence(dist, 10)
	if pct >= 0.70 {
		t.Errorf("expected below 0.70, got %f", pct)
	}
}

func TestComputeConvergence_EmptyDistribution(t *testing.T) {
	pct, dominant := computeConvergence(map[int]int{}, 0)
	if pct != 0 {
		t.Errorf("expected 0, got %f", pct)
	}
	if dominant != 0 {
		t.Errorf("expected dominant=0, got %d", dominant)
	}
}

func TestComputeConvergence_SingleUser(t *testing.T) {
	dist := map[int]int{3: 1}
	pct, dominant := computeConvergence(dist, 1)
	if pct != 1.0 {
		t.Errorf("expected 1.0, got %f", pct)
	}
	if dominant != 3 {
		t.Errorf("expected dominant=3, got %d", dominant)
	}
}
