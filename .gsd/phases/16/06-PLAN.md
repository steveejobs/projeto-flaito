---
phase: 16
plan: 6
wave: 6
---

# Wave 6: Observability & forecasting

Provide high-fidelity financial visibility and automated anomaly response.

## Tasks

- [ ] Create `20260422150000_stage16_forecasting.sql`
    - [ ] Add `pipeline_stage` granularity to logs
    - [ ] `vw_cost_forecasting`: growth-aware projections (7d/30d/Growth)
    - [ ] `tr_detect_cost_anomaly`: trigger automated warning/incident
- [ ] Add view for `vw_worker_efficiency` (latency vs cost)
- [ ] Verify that anomaly injection triggers a Warning mode automatically.

## Verification

- Check forecasting accuracy against a 7-day manual calculation.
- Inject a cost row 5x baseline and verify if office budget state switches to 'warning'.
