---
name: block-skip-hooks
enabled: true
event: bash
action: block
pattern: (?s)\bgit\b(?:\s+-[cC]\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+commit\b.*?(?:--no-v\w*|\s-[a-zA-Z]*n[a-zA-Z]*\b)|SKIP_SIMPLE_GIT_HOOKS\s*=\s*['"]?1|SIMPLE_GIT_HOOKS_RC|core\.hooksPath
---

🚫 **No se saltean los hooks de git.**

`pre-commit` corre typecheck, lint, formato y los tests de `packages/shared`; `commit-msg` corre el floor guard (CONSTRAINTS.md, ADR-013, ADR-015). Esta regla bloquea `--no-verify`/`-n` (también abreviado o combinado, como `-nm`), `core.hooksPath`, `SKIP_SIMPLE_GIT_HOOKS` y `SIMPLE_GIT_HOOKS_RC`.

Si querés quitar o saltear un test a propósito, poné el motivo en el mensaje con el trailer `Floor-Test-Change: <motivo>`.

Si falla: arreglá el código. Si creés que la regla está mal, pará y avisale a Tomás; no la esquives.
