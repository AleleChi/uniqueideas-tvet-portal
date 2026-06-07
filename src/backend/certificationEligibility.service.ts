/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Beneficiary, ProgramStatus } from "../types";
import { getDynamicEligibility } from "./db";

export class CertificationEligibilityService {
  /**
   * Evaluates if a given trainee is fully qualified to enter the certification workflow.
   */
  static isEligibleForCertification(b: Beneficiary): boolean {
    const bStatus = b.beneficiaryStatus || "ACTIVE";

    // 1. Must have a baseline status of ACTIVE or COMPLETED
    if (bStatus !== "ACTIVE" && bStatus !== "COMPLETED") {
      return false;
    }

    // 2. Explicitly prevent any negative administrative state transition
    const barredStatuses = ["WITHDRAWN", "DISQUALIFIED", "FAILED_VERIFICATION", "REMOVED"];
    if (barredStatuses.includes(bStatus)) {
      return false;
    }

    // 3. Trainee must be within permissible age bounds (ELIGIBLE) or possess an approved override
    const { eligibilityStatus } = getDynamicEligibility(b);
    if (eligibilityStatus !== "ELIGIBLE" && eligibilityStatus !== "OVERRIDDEN") {
      return false;
    }

    // 4. Must not be clinically FLAGGED
    if (b.status === ProgramStatus.FLAGGED) {
      return false;
    }

    return true;
  }
}
