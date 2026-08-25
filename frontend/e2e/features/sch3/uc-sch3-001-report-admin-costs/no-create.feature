# DIVERGENCE — this scenario is DELIBERATELY RED. It reproduces defects.md DIV-1 and stays failing until
# the app is fixed or BA/QA rule the behaviour intended. Do not weaken it, skip it, or "fix" it by
# asserting the current behaviour: the failing state IS the tracking signal. Filter it out of a
# fresh-failures run with `npm run test:gate`.
#
# WHAT IT REPRODUCES
# A reporter cannot START a Schedule 3. Legacy created the schedule's summary row on the FIRST Save — that
# is what `Schedule3MB.isScheduleOpen()` reported on, and why the legacy Gherkin has slices (S18/S19) for
# "the schedule has to be saved before opening other costs". The rewrite has no such path: every Schedule 3
# operation resolves the category-3 summary first and answers 404 "Schedule not found." when it is absent
# (Schedule3Service.java:170 for the read, :1070 for every write). Schedule 2 by contrast inserts its own
# summary on save (Schedule2Repository:200), so this is not an app-wide convention.
#
# The consequence is not hypothetical: in the delivery extract, 118 mill-years carry the
# ILCR_REPORT_CATEGORY row that says Schedule 3 IS required, and only 31 have a summary. So 87 Draft
# mill-years — including the anchor below — show "Schedule not found." where legacy would have opened an
# empty, enterable form. The same gap is why this suite has to seed its own anchors
# (real-test-data-patches/sch3/draft-anchors.sql).
#
# This anchor is deliberately NOT patched, and nothing writes to it.

@sch3 @UC-SCH3-001 @no-create
Feature: Report Forest Management Administration Costs (Schedule 3) — starting a schedule that was never saved
  As a mill reporter
  I want to open Schedule 3 for a reporting year I have not yet entered
  So that I can record the mill's administration costs for the first time

  @discovered-divergence @p0 @S16
  Scenario: A Draft mill-year whose Schedule 3 was never started opens an empty enterable form
    Given the Schedule 3 render-state anchor "never-started"
    And I have selected that mill and reporting year on the Home page
    When I open Schedule 3 expecting a guard
    Then the Schedule 3 form is displayed for entry
    And I should not see the message "Schedule not found."
