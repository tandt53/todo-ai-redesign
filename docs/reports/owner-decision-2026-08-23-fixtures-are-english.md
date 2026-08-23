# Owner decision, 2026-08-23 — test fixtures are written in English

Owner: *"ngôn ngữ dùng trong data test là tiếng anh nhé"*, answering T-061.

## The decision

**Fixture data is English.** T-061 posed the choice as: are fixtures a stand-in
for what a real user types, or a developer convenience? The answer is the second.

## The consequence, which is the whole point of asking

Fixtures no longer stand in for real input, **so the Vietnamese input path needs
its own coverage.** It was previously carried implicitly, by fixtures happening
to contain Vietnamese; that is now gone and nothing replaces it by default.

This is the half of T-061 that outlives the decision, and it is the half most
likely to be dropped: an English fixture suite passes cleanly and says nothing
about Vietnamese, so the gap is silent rather than red.

BUG-005 is the bug this was raised against.

## What happens next

A test task covering the Vietnamese input path, owned by the QA agent for the
platform where the input arrives. **T-061 does not close until that exists** —
closing it on the decision alone converts a known gap into an unknown one.
