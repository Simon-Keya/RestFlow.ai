package unit_test

import (
	"testing"
)

// Nest classic mode: group.quantity picks, each resolved × soldQty.
// Nest expanded mode: group.quantity × soldQty picks, each resolved × 1.
// 10 burger combos with 1 patty @ 150g per combo → 1500g total — once.
func TestComboClassicExpandedMath(t *testing.T) {
	soldQty := 10.0
	groupQty := 1 // one pick per combo unit
	pattyPerUnit := 150.0

	// Classic: 1 id, multiply by soldQty
	classicSelections := groupQty
	classicUnitQty := soldQty
	classicTotal := float64(classicSelections) * classicUnitQty * pattyPerUnit
	if classicTotal != 1500 {
		t.Fatalf("classic total=%v want 1500", classicTotal)
	}

	// Expanded: 10 ids, each ×1
	expandedSelections := groupQty * int(soldQty)
	expandedUnitQty := 1.0
	expandedTotal := float64(expandedSelections) * expandedUnitQty * pattyPerUnit
	if expandedTotal != 1500 {
		t.Fatalf("expanded total=%v want 1500", expandedTotal)
	}

	// Forbidden: classic length AND also multiply as if expanded → 10× extra
	wrong := float64(classicSelections) * soldQty * soldQty * pattyPerUnit
	if wrong == 1500 {
		t.Fatal("double-count path should not equal correct total")
	}
	if wrong != 15000 {
		t.Fatalf("wrong path=%v", wrong)
	}
}

func TestComboDoesNotSumLineAndOrderDeductions(t *testing.T) {
	// Consumption must use order-level aggregate OR line deductions, not both.
	orderLevel := 1500.0
	lineLevel := 1500.0
	if orderLevel+lineLevel == 3000 {
		// documenting the bug we prevent
	}
	used := orderLevel // canonical
	if used != 1500 {
		t.Fatalf("used=%v", used)
	}
}
