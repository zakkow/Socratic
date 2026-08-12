# Coding Standards

Apply these to every file you generate. Code should read like it was written by a careful senior engineer under a deadline, not like an AI wrote it.

## Comments
- Comment WHY, never WHAT. If a comment restates what the next line obviously does, delete the comment.
- No comment blocks that narrate the file top-to-bottom. No "// Step 1: fetch data" / "// Step 2: render UI" scaffolding comments.
- No emoji in code or comments.
- JSDoc/docstrings only on functions where the signature alone doesn't make the behavior obvious — not on every function by default.

## Naming
- Full words, no abbreviations invented on the spot (`userId` not `usrId`, but don't write `theCurrentlyLoggedInUsersIdentifier` either — match the verbosity to how a real codebase would name it).
- Boolean names read as questions or states: `isLoading`, `hasError`, not `loadingFlag`.
- No generic names (`data`, `temp`, `handleStuff`) when a specific name is one word longer and clearer.

## Structure
- Small, single-responsibility components/functions. If a component does data-fetching, state management, AND rendering with no separation, split it.
- No dead code, no commented-out code left in, no unused imports or variables.
- No placeholder TODOs left unresolved in delivered code — either implement it or don't stub it out.
- Don't add abstraction (config objects, factory patterns, generic wrappers) for things only used once. Write the direct version.

## Error handling
- Every fetch call handles both the error case and loading state in the UI — no silent failures, no unhandled promise rejections.
- Don't wrap every function in try/catch defensively — only where an error is actually possible and actionable.
- User-facing error messages are plain language, not raw error objects or stack traces.

## Formatting
- Consistent, idiomatic for the language (Prettier defaults for JS/JSX, standard PEP 8 for Python).
- No inline styles when a design-system class already covers it.

## Before finishing
Reread what you wrote and remove anything that exists to look thorough rather than to work correctly — that includes excessive comments, unused props/parameters, and defensive code for cases that can't happen given the actual API contract.