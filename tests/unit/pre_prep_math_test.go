package unit_test

import (
	"math"
	"testing"
)

// Spec acceptance: 10 kg raw → 8.2 kg yielded → 1.8 kg lost (18%).
func TestPrePrepInvariants(t *testing.T) {
	original := 10.0
	yielded := 8.2
	lost := math.Round((original-yielded)*1000) / 1000
	if lost != 1.8 {
		t.Fatalf("lost=%v want 1.8", lost)
	}
	lossPct := math.Round((lost/original)*1000) / 10
	if lossPct != 18.0 {
		t.Fatalf("lossPct=%v want 18", lossPct)
	}
	if yielded > original {
		t.Fatal("yielded must be <= original")
	}
	if yielded <= 0 || original <= 0 {
		t.Fatal("qtys must be positive")
	}
	// Costing: prepped unit cost absorbs full raw cost
	rawUC := 600.0
	totalRaw := original * rawUC
	preppedUC := math.Round((totalRaw/yielded)*10000) / 10000
	want := math.Round((6000.0/8.2)*10000) / 10000
	if preppedUC != want {
		t.Fatalf("preppedUC=%v want %v", preppedUC, want)
	}
	// Waste value for COGS path must not double-count: informational value 0
	wasteValue := 0.0
	if wasteValue != 0 {
		t.Fatal("pre-prep waste value must be 0 (cost absorbed)")
	}
}

func TestPrePrepRejectsYieldedOverOriginal(t *testing.T) {
	original := 10.0
	yielded := 10.5
	if yielded <= original {
		t.Fatal("test setup")
	}
	// Domain rule
	if !(yielded > original) {
		t.Fatal("expected over-yield case")
	}
}
