# Re-grounded from UC-SCH3-001-S09..S12.feature (AF5) — Check Status across all four outcomes.
#
# WHAT RE-GROUNDING CHANGED
#  * Results render as Carbon `InlineNotification`s (one per error) whose severity is carried by an
#    explicit title word, never colour alone (WCAG 2.1 AA) — not a `p:messages` panel. Each error reads
#    `<field label>: <message>`; both messages and every label are unchanged from legacy.
#  * The legacy S10 pinned two representative fields ("Value Required" for the two volumes). This asserts
#    the WHOLE inventory the backend checks — 11 Harvest amounts, the 8 PO&P amounts, both volumes —
#    because a check that silently stopped flagging one field is exactly the regression worth catching.
#  * Check Status mutates nothing by contract (AD-5), so all four scenarios run on shared READ-ONLY
#    anchors whose stored amounts are seeded by the patch. That is what makes the outcomes a property of
#    the data rather than of the scenario order.
#  * BR-10 (S12): the app suppresses the Harvest>=PO&P check on the other-acceptable rows when Override
#    is "Y", which is what S12 asserts and what passes. It ALSO suppresses it on the fixed lines, which
#    the legacy sidecar does not describe — recorded as DIV-2 rather than adjudicated here. The third
#    scenario below is S12's mirror, so the suppression is proven to discriminate.

@sch3 @UC-SCH3-001 @check-status
Feature: Report Forest Management Administration Costs (Schedule 3) — Check Status
  As a mill reporter
  I want Check Status to tell me whether Schedule 3 is complete and self-consistent
  So that I can correct it before the Schedules 1-10 track is submitted

  @p0 @S09
  Scenario: Check Status confirms a complete schedule meets every requirement
    Given the Schedule 3 anchor "check-met"
    And Schedule 3 has been saved with every fixed line and both timber volumes
    And I have selected that mill and reporting year on the Home page
    When I open Schedule 3
    And I run Check Status on Schedule 3
    Then I should see the message "All requirements for this schedule have been met"
    And no Check Status errors are shown

  @p0 @S10
  Scenario: Check Status flags every mandatory field on an empty schedule
    Given the Schedule 3 anchor "check-empty"
    And I have selected that mill and reporting year on the Home page
    When I open Schedule 3
    And I run Check Status on Schedule 3
    Then every mandatory Schedule 3 field is flagged as required
    And I should not see the message "All requirements for this schedule have been met"

  @p1 @S10
  Scenario: Check Status flags the missing fields on itemized sub-page rows
    # The sub-page half of BR-11. Neither state is reachable through the UI — the Add panel refuses a
    # blank description and always writes both rows of a group — so both are SEEDED (see the patch).
    Given the Schedule 3 anchor "check-subpage-missing"
    And I have selected that mill and reporting year on the Home page
    When I open Schedule 3
    And I run Check Status on Schedule 3
    Then the "Subtotal Other Costs (Description)" field is flagged as required
    And the "Subtotal Other Costs (PO&P $)" field is flagged as required
    And the "Included Unacceptable Costs (Total $)" field is flagged as required
    And I should not see the message "All requirements for this schedule have been met"

  @p1 @S11
  Scenario: Check Status flags a fixed line whose Harvest is below its PO&P
    Given the Schedule 3 anchor "check-harvest-pop"
    And I have selected that mill and reporting year on the Home page
    When I open Schedule 3
    Then the seeded Schedule 3 amounts are displayed
    When I run Check Status on Schedule 3
    Then the "Wages/Salaries, incl Benefits" line is flagged as Harvest below PO&P
    And I should not see the message "All requirements for this schedule have been met"

  @p1 @S12
  Scenario: Check Status flags an other-acceptable row whose Total is below its PO&P
    Given the Schedule 3 anchor "check-oa-pop"
    And I have selected that mill and reporting year on the Home page
    When I open Schedule 3
    And I run Check Status on Schedule 3
    Then the other-acceptable subtotal is flagged as Harvest below PO&P
    And I should not see the message "All requirements for this schedule have been met"

  @p1 @S12
  Scenario: Setting Override to Yes suppresses the Harvest-below-PO&P check
    Given the Schedule 3 anchor "check-override"
    And I have selected that mill and reporting year on the Home page
    When I open Schedule 3
    And I run Check Status on Schedule 3
    # S12's own claim: the other-acceptable row's violation is not reported.
    Then the other-acceptable subtotal is not flagged as Harvest below PO&P
    # DIV-2: the app suppresses the fixed-line violation too, so the same schedule passes outright.
    And the "Wages/Salaries, incl Benefits" line is not flagged as Harvest below PO&P
    And I should see the message "All requirements for this schedule have been met"
