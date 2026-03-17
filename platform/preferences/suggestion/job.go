package suggestion

// computeConvergence returns the convergence percentage and the dominant value
// from a distribution of position preferences.
func computeConvergence(dist map[int]int, total int) (float64, int) {
	if total == 0 {
		return 0, 0
	}
	maxCount := 0
	dominant := 0
	for val, count := range dist {
		if count > maxCount {
			maxCount = count
			dominant = val
		}
	}
	return float64(maxCount) / float64(total), dominant
}
