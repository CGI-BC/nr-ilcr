# DIVERGENCE — this scenario is DELIBERATELY RED. It reproduces defects.md DIV-6, tracked upstream as
# bcgov/nr-ilcr#359, and stays failing until Check Status accounts for what is on screen. Do not weaken
# it, skip it, or "fix" it by asserting the current behaviour: the failing state IS the tracking signal.
# Filter it out of a fresh-failures run with `npm run test:gate`.
#
# WHAT IT REPRODUCES
# Check Status reports on the LAST SAVED schedule and silently ignores anything typed since. Change the
# Override switch (or any amount) and press Check Status without saving, and the answer describes the
# stored data, not the screen — with nothing telling the reporter that.
#
# Legacy could not behave this way. Its Check Status button was `ajax="false"`
# (`webapp/schedule3.xhtml:38,421`), i.e. a full form postback: JSF pushed every submitted field —
# including `overrideTotPopVal`, bound to `#{schedule3MB.schedule3.overrideTotalPop}` (`:323-324`) —
# into the bean during UPDATE_MODEL_VALUES, and only then ran `checkStatus()`, which validated that
# in-memory schedule and persisted nothing. So legacy checked what you were looking at.
#
# The rewrite cannot: `POST /api/v1/schedule3/check-status` takes only `millId` and `year` and carries NO
# request body (`Schedule3Api.java:85-87`), the client posts no payload
# (`useScheduleMutations.checkStatus` -> `api().post(url(suffix))`), and the service reads the persisted
# summary and details (`Schedule3Service.java:889-895`, `override = OVERRIDE_YES.equals(summary.location())`).
#
# WHY THIS ANCHOR AND WHY IT IS SAFE TO SHARE. `check-override` is seeded with Override "Y" plus two
# stored BR-03 violations, so it PASSES Check Status as it stands — which is exactly the starting point
# needed. The scenario only changes a dropdown and presses Check Status; Check Status mutates nothing by
# contract (AD-5) and nothing here is saved, so this stays a read-only scenario on a read-only anchor.
# The unmoved optimistic-lock token is asserted at the end to prove that.

@sch3 @UC-SCH3-001 @check-status-unsaved
Feature: Report Forest Management Administration Costs (Schedule 3) — Check Status and unsaved edits
  As a mill reporter
  I want Check Status to judge what is on my screen
  So that I am not told the schedule is fine when what I am looking at is not

  @discovered-divergence @p1 @S12
  Scenario: Check Status reflects an Override change that has not been saved yet [DISCOVERED DIVERGENCE — Check Status judges the SAVED schedule, ignoring the screen; defects.md DIV-6 / issue #359]
    Given the Schedule 3 anchor "check-override"
    And I have selected that mill and reporting year on the Home page
    When I open Schedule 3
    # As stored: Override "Y", so the two BR-03 violations are suppressed and the schedule passes.
    And I run Check Status on Schedule 3
    Then I should see the message "All requirements for this schedule have been met"
    # Now switch the override OFF on screen and check again WITHOUT saving. The stored violations are
    # no longer excused by what the reporter can see, so legacy would report both of them.
    When I set the Override Harvest and Total PO&P selection to "N"
    And I run Check Status on Schedule 3
    Then the "Wages/Salaries, incl Benefits" line is flagged as Harvest below PO&P
    And the other-acceptable subtotal is flagged as Harvest below PO&P
    And I should not see the message "All requirements for this schedule have been met"
    # Nothing was saved: Check Status must stay read-only whichever data it judges.
    And the Schedule 3 optimistic-lock token has not moved
