# Error tracking evaluation

- [ ] Inventory existing reporting, identity, background jobs, and missing capture paths.
  CHECK: `rg -n 'reportError|logger\.(error|fatal)|onError|errorHandler|unhandled|boss\.(work|schedule)' server/src client/src`
  EXPECT: A source-backed failure inventory and a proposed severity, feeder, and latch map.
- [ ] Evaluate maintained self-hosted tools against errors, user context, breadcrumbs, and Discord/email alerts.
  CHECK: `test -s /private/tmp/quickstart-error-tracking-research.md`
  EXPECT: Primary-source links and a recommendation, including operational and licensing distinctions.
- [ ] Present a concrete integration direction before implementation, following dev-log-alert phases A/B.
  CHECK: `test -s /private/tmp/quickstart-error-tracking-proposal.md`
  EXPECT: Coverage, acceptance checks, and explicit decisions needed from the user; no runtime changes before those decisions.
