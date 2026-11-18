# Prompts used

The assessment asks to share the prompts used. These are the prompts I gave the AI, in order. They are edited for grammar and clarity; routine confirmations (e.g. "continue", "approved") and repository housekeeping are left out. Each one has a short note on what it produced.

**Tooling:** Claude Code (Claude Opus 5.5) with the Superpowers skills (brainstorming, grilling, writing-plans, subagent-driven development, code review), plus a custom strict code-quality review skill.

**Not included:** the AI's replies, and the task briefs it wrote for its implementer and reviewer subagents. Those briefs were extracted directly from the plans ([build plan](superpowers/plans/2026-11-16-calculator.md), [refactor plan](superpowers/plans/2026-11-16-quality-refactor.md)). The outcomes of the design Q&A are recorded in the spec's [decision log](superpowers/specs/2026-11-16-calculator-design.md#8-decision-log).

## 1. Framing the project

> Let's implement a full-stack calculator application with a React frontend and a backend microservice. The frontend should consume the backend API to perform basic and advanced arithmetic operations. Focus on clean design, maintainable code, and a testable architecture. The requirements and deliverables are: *[the [assessment brief](brief.md)]*. The first step is to conceptualize the repository's architecture and structure. This will be a Go + React project.

→ Started a structured brainstorming session.

> I'd like the reviewers to remember the development journey as much as the result: the prompts, the workflow, and the decisions. Let's use a state-of-the-art AI-assisted workflow: specs, plans, design grilling, and reviews.

→ Made the process itself part of the deliverable.

> For the backend, let's run a grilling session to decide the libraries, the REST API design, and the error model. For the frontend, let's use atomic design for components, backed by a minimal design system, with responsiveness in mind.

> Please add dark mode to the design system as well.

> The interaction should work like a pocket calculator: users tap keys, following the same format as the default Apple, Android, and Windows calculators.

## 2. Visual design

> Let's review it with mockups.

> Let's go with a single keypad layout, and give the `=` key an accent color.

> The `=` key should use a contrasting color. Let's try orange.

→ Reviewing the mockup also surfaced a CSS bug in it, which was then fixed.

## 3. Behavior

> The calculator should follow standard order of operations: multiplication before addition.

> For `%`: on a single number it should divide by 100; within an expression it should act as a percentage of the left operand (e.g. `200 + 10% = 220`). The physical keyboard should work as well. Pressing `=` again should repeat the last operation (e.g. `5 + 5 = 10`, then `=` gives `15`). Let's deliver a basic calculator first, and evaluate a scientific mode afterwards.

→ Order of operations, contextual `%`, keyboard support and repeated `=`. Scientific mode became an explicit non-goal for v1.

## 4. Backend design grilling

> Let's go through the decisions one at a time, with options for each.

→ Decided through multiple-choice questions:
- **Endpoints:** math lives in the backend, with both an expression endpoint and single-operation endpoints.
- **Libraries:** chi for routing; `float64` with rounding to 15 significant digits.
- **Errors:** a structured error envelope.
- **Parsing:** a plain-string wire format and a hand-written recursive-descent parser.
- **Structure:** `cmd` + `internal/calc` + `internal/api`.
- **Testing:** standard-library tests only.
- **Operations:** health check, structured logging, timeouts and body limits, and an OpenAPI contract.
- **Deployment:** one container image.

> Can we use Docker Compose for running it?

→ Compose wraps the single image, so the stack runs with one command.

> Let's write the spec. For division by zero, the calculator should display "Undefined".

> Approved. Please commit the spec and write the implementation plan.

## 5. Brand

> The calculator should use Sezzle's visual identity: colors, typeface, and UI patterns from https://sezzle.com.

→ The palette, Satoshi typeface, pill-shaped keys and glow effects were taken from sezzle.com's stylesheet, mocked up, then approved.

## 6. Build

> Let's execute the plan with subagent-driven development.

→ 15 tasks, each implemented by a fresh subagent and gated by an independent reviewer, then a final whole-branch review.

## 7. Code-quality review and refactor

> Run a strict code-quality review on the branch.

→ A custom review skill whose core prompt is: *"Perform a deep code quality audit of the current branch's changes. Rethink how to structure / implement the changes to meaningfully improve code quality without impacting behavior. Work to improve abstractions, modularity, reduce Spaghetti code, improve succinctness and legibility. Be ambitious, if there is a clear path to improving the implementation that involves restructuring some of the codebase, go for it. Be extremely thorough and rigorous. Measure twice, cut once."* It produced 7 structural findings.

> Let's address every finding.

→ A refactor plan and 5 more reviewed tasks. This included two deliberate changes to earlier decisions: repeated `=` moved to the client, and a simpler keyboard focus model.

## 8. Delivery

> Publish the repository to GitHub, and verify that everything the assessment asks for is covered.

> Check the repository against the assessment instructions and deliverables.

→ Added this file and the README's Assumptions section, and mapped every instruction and deliverable in the README's Requirements coverage table.
