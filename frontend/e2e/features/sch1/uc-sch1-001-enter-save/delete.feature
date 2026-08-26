# Re-grounded from _bmad-output/implementation-artifacts/tests/UC-SCH1-001/gherkin/UC-SCH1-001-S13.feature
# (legacy JSF/PrimeFaces). Delete the whole Schedule 1 (BR-08): the React/Carbon app confirms via a Carbon
# danger Modal ("Delete schedule" → primary "Delete"), then DELETE /api/v1/schedule1 removes the summary +
# every detail row (Schedule1Repository.deleteSchedule) and redisplays an empty, read-only schedule with
# the API's verbatim SUC-002 text (AD-8).
#
# Delete is DESTRUCTIVE and the app has no create-on-open path, so this scenario snapshots the target's
# rows to the E2E_BAK_SCH1_* tables before the delete and re-inserts them verbatim on teardown
# (scripts/sch1_db_restore.py; round-trip proven byte-identical). It runs against a DEDICATED target
# (25052/2016) that no other scenario touches, so it stays parallel-safe.

@sch1 @UC-SCH1-001 @delete
Feature: Report Average Cost of Logging (Schedule 1) — delete the whole Schedule 1
  As a mill reporter
  I want to delete an incorrectly recorded Schedule 1
  So that I can clear it and start over for the mill and reporting year

  @S13 @p1
  Scenario: Delete Schedule 1 after confirming the prompt
    Given a saved editable Schedule 1 exists for the delete target
    And I have selected that mill and reporting year on the Home page
    And I open Schedule 1
    When I delete Schedule 1 and confirm the prompt
    Then I should see the message "Data deleted successfully"
    And the Schedule 1 should no longer exist
    # RE-GROUNDED 2026-08-26 (defect #296): a deleted Schedule 1 no longer 404s and is no longer rendered
    # read-only — the page serves an empty EDITABLE form so the reporter can start over, with Delete gated
    # off. Uses the steps #296's own suite work added (`input form is displayed`, `every amount is blank`,
    # `Delete action is not offered`), which this scenario was left out of.
    And the Schedule 1 input form is displayed
    And every Schedule 1 amount is blank
    And the Schedule 1 Delete action is not offered
