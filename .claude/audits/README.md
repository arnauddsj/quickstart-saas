# Audits

Dated, adversarial reviews of one subsystem each. An audit treats `docs/` as hypotheses:
a disagreement between a doc and the code is itself a finding. Name files
`<topic>-audit-YYYY-MM-DD.md`.

Findings that survive verification become a doc, a TODO item, or a fix. The audit file
stays as the record of what was checked and how, so the next audit can start from it.

## Shape

1. **Verdict.** One paragraph answering the operational question the audit exists for
   ("would I trust this to page me at 3am?", "can a member read another organization's
   rows?").
2. **Invariant ledger.** A table with columns _invariant_ / _where enforced_ /
   _mechanism_ / _if violated_. Mechanism is one of `DB constraint`, `test`,
   `middleware`, `convention`; a convention is the weakest and the ledger says so.
   Each row cites the symbol or the grep that proves it.
3. **Findings**, ranked by user-visible consequence. Each has _Evidence_ (a command and
   its output, or a file and symbol), _Reproduction_, _Blast radius_, _Fix_, _Fix risk_.
   Tag `[known]` anything already in `.claude/TODO.md`.
4. **What was not checked**, so the next reader does not assume coverage.

Report what was actually verified: "checked 11 docs, 2 name symbols that no longer
exist" is useful; "docs look fine" is not.
