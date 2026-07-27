package main

import "testing"

func TestMatchesPurchaseBatchVersion(t *testing.T) {
	tests := []struct {
		name     string
		current  string
		expected string
		matches  bool
	}{
		{
			name:     "sqlite and api datetime formats represent the same version",
			current:  "2026-07-21 16:42:15.843Z",
			expected: "2026-07-21T16:42:15.843Z",
			matches:  true,
		},
		{
			name:     "different timestamps remain a conflict",
			current:  "2026-07-21 16:42:15.843Z",
			expected: "2026-07-21T16:42:16.000Z",
			matches:  false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := matchesPurchaseBatchVersion(test.current, test.expected); actual != test.matches {
				t.Fatalf("matchesPurchaseBatchVersion() = %t, want %t", actual, test.matches)
			}
		})
	}
}
