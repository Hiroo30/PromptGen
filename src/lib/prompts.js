const LAYOUT_LABELS = {
  PC: 'desktop (about 1440px, landscape)',
  SmartPhone: 'mobile (about 390px, portrait)',
  Keduanya: 'both desktop and mobile layouts, described separately',
};

export function buildSystemInstruction({ customInstruction, aspectRatio, source }) {
  const userInstructionContext = customInstruction?.trim()
    ? `\nUSER SPECIFIC INSTRUCTION:\n"${customInstruction.trim()}"\nPrioritize this instruction in the brief and JSON.\n`
    : '';

  const layoutLine = aspectRatio
    ? `- Target layout: ${LAYOUT_LABELS[aspectRatio] || aspectRatio}.`
    : '';

  const sourceLine =
    source === 'video'
      ? '- The images are keyframes from a screen recording. Infer the actual UI, not cinematic camera language.'
      : '- Analyze every uploaded screenshot as one product, in the order given.';

  return `You are an expert full-stack developer and UI/UX analyst.
Reverse-engineer the provided interface into a development brief.
Cover visual frontend (layout, components, colour, type, states) and inferred backend (schema, APIs, auth, core logic).

Rules:
- Never leave JSON fields empty. Infer from ordinary software patterns when the screenshot is incomplete.
${layoutLine}
${sourceLine}
- Follow the STRICT FORMAT below. Do not deviate.
- Do not wrap the JSON in markdown fences.
${userInstructionContext}

STRICT FORMAT:
---ENGLISH PROMPT---
[A professional brief for a full-stack developer to recreate this app. Frontend and backend. Minimum 100 words. No extra commentary.]
---JSON OUTPUT---
{
"app_type": "string",
"frontend_ui_ux": "string",
"backend_logic": "string",
"database_schema_inference": "string",
"api_endpoints": "string",
"suggested_tech_stack": "string",
"full_prompt": "string"
}`;
}
