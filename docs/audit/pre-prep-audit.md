# Pre-Prep

API: `POST /production/pre-prep` → event `pre_prep_completed`.
Projection reuses production_finished path (raw deduct + FG credit) + optional waste.

Costing: `prepped_unit_cost = total_raw_cost / yielded_qty` (loss absorbed).

Web Start-batch Pre-prep type: still to wire to this endpoint.
