package unit_test

import (
	"math"
	"testing"
)

func isMaterialVariance(qty, value float64) bool {
	q := math.Round(qty*100) / 100
	if math.Abs(q) >= 0.01 {
		return true
	}
	v := math.Round(value*100) / 100
	return math.Abs(v) >= 0.01
}

func TestVarianceHidesSubCent(t *testing.T) {
	cases := []struct {
		qty, val float64
		want     bool
	}{
		{0.004, 0, false},
		{-0.004, 0, false},
		{0.002, 0, false},
		{0.0, 0.004, false},
		{-0.35, 0, true},
		{0, 1.25, true},
		{0.01, 0, true},
	}
	for _, c := range cases {
		got := isMaterialVariance(c.qty, c.val)
		if got != c.want {
			t.Fatalf("qty=%v val=%v got=%v want=%v", c.qty, c.val, got, c.want)
		}
	}
}
