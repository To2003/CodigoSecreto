---
name: block-skip-hooks
enabled: true
event: bash
action: block
pattern: git\s+commit\b.*(--no-verify|\s-n\b)|SKIP_SIMPLE_GIT_HOOKS=1
---

🚫 **No se saltea el pre-commit.**

El hook corre `pnpm check:fast` (typecheck, lint, formato, floor guard) y los tests de `packages/shared` (CONSTRAINTS.md, ADR-013).

Si falla: arreglá el código. Si creés que la regla está mal, pará y avisale a Tomás; no la esquives.
