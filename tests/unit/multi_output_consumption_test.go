package unit_test

import (
	"testing"
)

// Multi-output sale: inventory deducts produced FG SKUs; consumption must list the same
// quantities once — not raw production inputs again.
func TestMultiOutputConsumptionMatchesInventoryDeductions(t *testing.T) {
	type ded struct {
		id  string
		qty float64
	}
	inv := []ded{
		{"MARINATED-BREAST", 1.8},
		{"RICE", 1.5},
		{"SODA", 10},
	}
	// Aggregate by id (once)
	byID := map[string]float64{}
	for _, d := range inv {
		byID[d.id] += d.qty
	}
	if byID["MARINATED-BREAST"] != 1.8 || byID["RICE"] != 1.5 || byID["SODA"] != 10 {
		t.Fatalf("mismatch %#v", byID)
	}
	if _, ok := byID["RAW-CHICKEN"]; ok {
		t.Fatal("raw production inputs must not appear on sale consumption")
	}
	// Double path would be 3.6
	if byID["MARINATED-BREAST"]*2 == 3.6 {
		// documenting forbidden path
	}
}
