package mapper

import "strings"

// NormalizedEditDistance returns 0.0 (identical) to 1.0 (completely different)
// using Levenshtein distance divided by max(len(a), len(b)).
func NormalizedEditDistance(a, b string) float64 {
	a = strings.ToLower(a)
	b = strings.ToLower(b)

	if a == b {
		return 0.0
	}

	la, lb := len(a), len(b)
	if la == 0 || lb == 0 {
		return 1.0
	}

	dist := levenshtein(a, b)
	maxLen := la
	if lb > maxLen {
		maxLen = lb
	}
	return float64(dist) / float64(maxLen)
}

// levenshtein computes the edit distance between two strings using
// standard dynamic programming with O(min(m,n)) space.
func levenshtein(a, b string) int {
	la, lb := len(a), len(b)

	// Ensure a is the shorter string for space optimization.
	if la > lb {
		a, b = b, a
		la, lb = lb, la
	}

	prev := make([]int, la+1)
	curr := make([]int, la+1)

	for i := 0; i <= la; i++ {
		prev[i] = i
	}

	for j := 1; j <= lb; j++ {
		curr[0] = j
		for i := 1; i <= la; i++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			ins := curr[i-1] + 1
			del := prev[i] + 1
			sub := prev[i-1] + cost

			min := ins
			if del < min {
				min = del
			}
			if sub < min {
				min = sub
			}
			curr[i] = min
		}
		prev, curr = curr, prev
	}

	return prev[la]
}

// tokenize splits a string on underscores and common delimiters, returning
// lowercase tokens with empty strings removed.
func tokenize(s string) []string {
	s = strings.ToLower(s)
	// Replace common delimiters with spaces for uniform splitting.
	for _, d := range []string{"_", "-", ".", " "} {
		s = strings.ReplaceAll(s, d, " ")
	}
	parts := strings.Fields(s)
	return parts
}

// TokenOverlap splits on "_" and common delimiters, compares token sets.
// Returns 0.0 (no overlap) to 1.0 (identical tokens).
func TokenOverlap(a, b string) float64 {
	tokA := tokenize(a)
	tokB := tokenize(b)

	if len(tokA) == 0 || len(tokB) == 0 {
		return 0.0
	}

	setB := make(map[string]bool, len(tokB))
	for _, t := range tokB {
		setB[t] = true
	}

	overlap := 0
	for _, t := range tokA {
		if setB[t] {
			overlap++
		}
	}

	// Jaccard-style: overlap / union size
	setA := make(map[string]bool, len(tokA))
	for _, t := range tokA {
		setA[t] = true
	}
	for _, t := range tokB {
		setA[t] = true
	}
	union := len(setA)

	if union == 0 {
		return 0.0
	}
	return float64(overlap) / float64(union)
}

// ColumnNameSimilarity combines edit distance and token overlap.
// Both inputs are lowercased before comparison.
// Score = 0.6 * (1 - editDistance) + 0.4 * tokenOverlap
func ColumnNameSimilarity(source, target string) float64 {
	ed := NormalizedEditDistance(source, target)
	to := TokenOverlap(source, target)
	return 0.6*(1.0-ed) + 0.4*to
}
