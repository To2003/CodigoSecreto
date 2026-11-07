---
name: warn-spec-edit
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: (^|/)SPEC\.md$
---

⚠️ **Estás editando `SPEC.md`.**

El SPEC es la fuente de verdad y **solo cambia con OK explícito de Tomás**. Si no tenés ese OK en esta conversación, deshacé el cambio y anotá la propuesta en `docs/BACKLOG.md` o preguntá.
