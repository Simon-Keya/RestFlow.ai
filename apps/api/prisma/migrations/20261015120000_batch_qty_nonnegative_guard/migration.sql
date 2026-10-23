-- Guard new/updated batch balances without failing deployment on legacy rows.
-- Existing negative rows, if any, must be audited and corrected before VALIDATE CONSTRAINT.
ALTER TABLE "InventoryBatch"
  ADD CONSTRAINT "InventoryBatch_qty_remaining_nonnegative_check"
  CHECK (qty_remaining >= 0) NOT VALID;
